// Button taps on an ask card: ✋ Claim, ✅ Done.
// Done is only allowed after Claim; it then asks the user to reply with an outcome.
const db = require('../../infrastructure/db/asksRepository');
const { URGENCIES, EFFORT_UNIT_KEYS, effortLabel } = require('../../domain/constants');
const { displayName, outcomePrompt, effortQtyKeyboard } = require('../../presentation/keyboards');
const { refreshCard } = require('../cards');

// Shared precondition for both effort steps: the ask must exist, be claimed, and
// be acted on by its claimer (owns() closes over the actor). Answers the callback
// with the reason and returns null on any failure; returns the ask row otherwise.
async function effortGuard(bot, q, id, owns) {
  const ask = await db.getAsk(id);
  if (!ask) { await bot.answerCallbackQuery(q.id, { text: 'Ask not found.' }); return null; }
  if (ask.status !== 'claimed') {
    await bot.answerCallbackQuery(q.id, { text: 'Claim it first to set effort.', show_alert: true });
    return null;
  }
  if (!owns(ask.claimer_id, ask.claimer)) {
    await bot.answerCallbackQuery(q.id, { text: 'Only the claimer can set effort.', show_alert: true });
    return null;
  }
  return ask;
}

function register(bot) {
  bot.on('callback_query', async (q) => {
    try {
      const parts = (q.data || '').split(':');
      const [action, idStr, value] = parts;
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

      // Effort is a two-tap pick by the claimer (only while claimed, only by the
      // claimer). Step 1 — tapping a unit ('eff') doesn't write anything; it swaps
      // the unit buttons for that unit's quantity picker. Both steps re-check the
      // ask state so a stale button can't act on a closed/reassigned ask.
      if (action === 'eff') {
        if (!EFFORT_UNIT_KEYS.includes(value)) return void bot.answerCallbackQuery(q.id);
        const guard = await effortGuard(bot, q, id, owns);
        if (!guard) return;
        if (!q.message) return void bot.answerCallbackQuery(q.id, { text: 'This ask is too old to act on.' });
        await bot.answerCallbackQuery(q.id, { text: `how many ${value}?` });
        try {
          await bot.editMessageReplyMarkup(effortQtyKeyboard(id, value), {
            chat_id: q.message.chat.id,
            message_id: q.message.message_id,
          });
        } catch (err) {
          if (!/not modified/i.test(err.message)) console.warn('editMessageReplyMarkup:', err.message);
        }
        return;
      }

      // Step 2 — tapping a quantity ('effq') sets the effort (e.g. '2 days') and
      // re-renders the card, which restores the unit picker so it can be redone.
      if (action === 'effq') {
        const effort = effortLabel(value, Number(parts[3]));
        if (!effort) return void bot.answerCallbackQuery(q.id);
        const guard = await effortGuard(bot, q, id, owns);
        if (!guard) return;
        const row = await db.setEffort(id, effort);
        if (!row) return void bot.answerCallbackQuery(q.id, { text: 'Could not update — it may have changed.' });
        await bot.answerCallbackQuery(q.id, { text: `effort: ${effort}` });
        return void refreshCard(bot, row);
      }

      // ← back from the quantity picker: just redraw the card's unit picker.
      if (action === 'effback') {
        const ask = await db.getAsk(id);
        if (!ask) return void bot.answerCallbackQuery(q.id, { text: 'Ask not found.' });
        await bot.answerCallbackQuery(q.id);
        return void refreshCard(bot, ask);
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
