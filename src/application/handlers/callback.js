// Button taps on an ask card: ✋ Claim, 🔍 Scope, ✅ Done.
// Done is only allowed after Claim; it then asks the user to reply with an outcome.
const db = require('../../infrastructure/db/asksRepository');
const { displayName } = require('../../presentation/keyboards');
const { pendingOutcome } = require('../state');
const { refreshCard } = require('../cards');

function register(bot) {
  bot.on('callback_query', async (q) => {
    try {
      const [action, idStr] = (q.data || '').split(':');
      const id = Number(idStr);
      const actor = displayName(q.from);

      if (action === 'claim') {
        const row = await db.claimAsk(id, actor);
        if (!row) return void bot.answerCallbackQuery(q.id, { text: 'Already claimed or closed.' });
        await bot.answerCallbackQuery(q.id, { text: `✋ It's yours, @${actor}!` });
        return void refreshCard(bot, row);
      }

      if (action === 'scope') {
        const row = await db.scopeAsk(id);
        if (!row) return void bot.answerCallbackQuery(q.id, { text: 'Can only scope an open ask.' });
        await bot.answerCallbackQuery(q.id, { text: '🔍 Marked as scoping.' });
        return void refreshCard(bot, row);
      }

      if (action === 'done') {
        const ask = await db.getAsk(id);
        if (!ask) return void bot.answerCallbackQuery(q.id, { text: 'Ask not found.' });
        // The guard: Done is only allowed after Claim.
        if (ask.status !== 'claimed') {
          return void bot.answerCallbackQuery(q.id, { text: '✋ Claim it first', show_alert: true });
        }
        const chatId = q.message.chat.id;
        pendingOutcome.set(`${chatId}:${q.from.id}`, id);
        await bot.answerCallbackQuery(q.id);
        return void bot.sendMessage(
          chatId,
          `@${actor} reply to this with the outcome (a link or what you learned) to close ask #${id}.`,
          { message_thread_id: q.message.message_thread_id, reply_markup: { force_reply: true, selective: true } }
        );
      }

      await bot.answerCallbackQuery(q.id);
    } catch (err) {
      console.error('callback error:', err.message);
      try { await bot.answerCallbackQuery(q.id, { text: 'Something went wrong.' }); } catch (_) {}
    }
  });
}

module.exports = { register };
