// Button taps on an ask card: ✋ Claim, ✅ Done.
// Done is only allowed after Claim; it then asks the user to reply with an outcome.
const db = require('../../infrastructure/db/asksRepository');
const { URGENCIES, EFFORTS } = require('../../domain/constants');
const { displayName } = require('../../presentation/keyboards');
const { pendingOutcome, pendingEffort } = require('../state');
const { refreshCard } = require('../cards');

function register(bot) {
  bot.on('callback_query', async (q) => {
    try {
      const [action, idStr, value] = (q.data || '').split(':');
      const id = Number(idStr);
      const actor = displayName(q.from);
      const actorId = String(q.from.id);
      if (!Number.isInteger(id)) return void bot.answerCallbackQuery(q.id);

      // Ownership by stable Telegram id (display names are spoofable). Fall back
      // to the display name for legacy rows saved before ids were stored.
      const owns = (storedId, storedName) => (storedId ? storedId === actorId : storedName === actor);

      // Asker sets urgency — only while the ask isn't closed, only by the asker.
      if (action === 'urg') {
        if (!URGENCIES.includes(value)) return void bot.answerCallbackQuery(q.id);
        const ask = await db.getAsk(id);
        if (!ask) return void bot.answerCallbackQuery(q.id, { text: 'Ask not found.' });
        if (ask.status === 'done') return void bot.answerCallbackQuery(q.id, { text: 'This ask is already closed.' });
        if (!owns(ask.asker_id, ask.asker)) {
          return void bot.answerCallbackQuery(q.id, { text: 'Only the asker can set urgency.', show_alert: true });
        }
        const row = await db.setUrgency(id, value);
        if (!row) return void bot.answerCallbackQuery(q.id, { text: 'Could not update — it may have changed.' });
        await bot.answerCallbackQuery(q.id, { text: `urgency: ${value}` });
        return void refreshCard(bot, row);
      }

      // Claimer sets effort — only after they've claimed it, only by the claimer.
      // A preset value sets it directly; 'custom' asks them to type an exact amount.
      if (action === 'eff') {
        const ask = await db.getAsk(id);
        if (!ask) return void bot.answerCallbackQuery(q.id, { text: 'Ask not found.' });
        if (ask.status !== 'claimed') {
          return void bot.answerCallbackQuery(q.id, { text: 'Claim it first to set effort.', show_alert: true });
        }
        if (!owns(ask.claimer_id, ask.claimer)) {
          return void bot.answerCallbackQuery(q.id, { text: 'Only the claimer can set effort.', show_alert: true });
        }

        if (value === 'custom') {
          if (!q.message) return void bot.answerCallbackQuery(q.id, { text: 'This ask is too old to act on.' });
          const chatId = q.message.chat.id;
          await bot.answerCallbackQuery(q.id);
          const sent = await bot.sendMessage(
            chatId,
            `@${actor} reply to this with the effort for ask #${id} (e.g. "3 days", "2.5 hrs").`,
            { message_thread_id: q.message.message_thread_id, reply_markup: { force_reply: true, selective: true } }
          );
          pendingEffort.set(`${chatId}:${sent.message_id}`, { askId: id, userId: q.from.id });
          return;
        }

        if (!EFFORTS.includes(value)) return void bot.answerCallbackQuery(q.id);
        const row = await db.setEffort(id, value);
        if (!row) return void bot.answerCallbackQuery(q.id, { text: 'Could not update — it may have changed.' });
        await bot.answerCallbackQuery(q.id, { text: `effort: ${value}` });
        return void refreshCard(bot, row);
      }

      if (action === 'claim') {
        const row = await db.claimAsk(id, actor, q.from.id);
        if (!row) return void bot.answerCallbackQuery(q.id, { text: 'Already claimed or closed.' });
        await bot.answerCallbackQuery(q.id, { text: `✋ It's yours, @${actor}!` });
        return void refreshCard(bot, row);
      }

      if (action === 'done') {
        const ask = await db.getAsk(id);
        if (!ask) return void bot.answerCallbackQuery(q.id, { text: 'Ask not found.' });
        // The guard: Done is only allowed after Claim.
        if (ask.status !== 'claimed') {
          return void bot.answerCallbackQuery(q.id, { text: '✋ Claim it first', show_alert: true });
        }
        if (!q.message) return void bot.answerCallbackQuery(q.id, { text: 'This ask is too old to act on.' });
        const chatId = q.message.chat.id;
        await bot.answerCallbackQuery(q.id);
        const sent = await bot.sendMessage(
          chatId,
          `@${actor} reply to this with the outcome (a link or what you learned) to close ask #${id}.`,
          { message_thread_id: q.message.message_thread_id, reply_markup: { force_reply: true, selective: true } }
        );
        pendingOutcome.set(`${chatId}:${sent.message_id}`, { askId: id, userId: q.from.id });
        return;
      }

      await bot.answerCallbackQuery(q.id);
    } catch (err) {
      console.error('callback error:', err.message);
      try { await bot.answerCallbackQuery(q.id, { text: 'Something went wrong.' }); } catch (_) {}
    }
  });
}

module.exports = { register };
