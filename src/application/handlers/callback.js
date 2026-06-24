// Button taps on an ask card: ✋ Claim, ✅ Done.
// Done is only allowed after Claim; it then asks the user to reply with an outcome.
const db = require('../../infrastructure/db/asksRepository');
const { URGENCIES, EFFORTS } = require('../../domain/constants');
const { displayName, outcomePrompt } = require('../../presentation/keyboards');
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

      // Claimer taps an effort estimate — only after they've claimed it, only by
      // the claimer. One tap sets the effort directly (e.g. '~hrs') and re-renders
      // the card; re-tapping a different unit just overwrites it.
      if (action === 'eff') {
        if (!EFFORTS.includes(value)) return void bot.answerCallbackQuery(q.id);
        const ask = await db.getAsk(id);
        if (!ask) return void bot.answerCallbackQuery(q.id, { text: 'Ask not found.' });
        if (ask.status !== 'claimed') {
          return void bot.answerCallbackQuery(q.id, { text: 'Claim it first to set effort.', show_alert: true });
        }
        if (!owns(ask.claimer_id, ask.claimer)) {
          return void bot.answerCallbackQuery(q.id, { text: 'Only the claimer can set effort.', show_alert: true });
        }
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
        // The reply is matched back to this ask in message.js by reading the id
        // out of the prompt text — no in-memory state, so it survives a restart.
        await bot.sendMessage(
          chatId,
          outcomePrompt(actor, id),
          { message_thread_id: q.message.message_thread_id, reply_markup: { force_reply: true, selective: true } }
        );
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
