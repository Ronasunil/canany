// Incoming messages: outcome capture (the reply that closes a 'done' ask) and
// new asks (an #ask-prefixed message in any group or DM).
// Slash commands are handled separately in ../commands.js.
const config = require('../../config');
const db = require('../../infrastructure/db/asksRepository');
const views = require('../../presentation/views');
const { displayName, threadLink, keyboardFor, threadOpts } = require('../../presentation/keyboards');
const { pendingOutcome, pendingEffort } = require('../state');
const { refreshCard } = require('../cards');

const ASK_PREFIX = config.behavior.askPrefix;

function register(bot) {
  bot.on('message', async (msg) => {
    try {
      const text = (msg.text || '').trim();
      if (!text) return;

      const chatId = msg.chat.id;
      const userKey = `${chatId}:${msg.from.id}`;

      // 1) Custom-effort capture — the claimer's reply with an exact amount
      //    (set after tapping ✏️ Custom effort). Skip commands / new asks.
      if (pendingEffort.has(userKey) && !text.startsWith('/') && !text.startsWith(ASK_PREFIX)) {
        const askId = pendingEffort.get(userKey);
        pendingEffort.delete(userKey);
        const effort = text.trim().slice(0, 40);
        const row = await db.setEffort(askId, effort);
        await refreshCard(bot, row);
        await bot.sendMessage(chatId, `✅ Effort for ask #${askId}: ${effort}`, threadOpts(msg));
        return;
      }

      // 2) Outcome capture — the user's reply that closes a 'done' ask.
      //    (Skip if they're clearly doing something else: a command or a new ask.)
      if (pendingOutcome.has(userKey) && !text.startsWith('/') && !text.startsWith(ASK_PREFIX)) {
        const askId = pendingOutcome.get(userKey);
        pendingOutcome.delete(userKey);
        const row = await db.doneAsk(askId, text);
        if (row) {
          await refreshCard(bot, row);
          await bot.sendMessage(chatId, `✅ Ask #${askId} closed. Outcome saved.`, threadOpts(msg));
        } else {
          await bot.sendMessage(chatId, `Couldn't close ask #${askId} — it may have changed.`, threadOpts(msg));
        }
        return;
      }

      // 3) Slash commands are routed by ../commands.js — ignore them here.
      if (text.startsWith('/')) return;

      // 4) New ask — any message that starts with the prefix (in a group or DM).
      if (!text.startsWith(ASK_PREFIX)) return;

      const askText = text.slice(ASK_PREFIX.length).trim() || text;
      const asker = displayName(msg.from);

      // Effort and urgency start empty: the asker sets urgency and the claimer
      // sets effort, both via buttons on the card (no auto-guessing).
      const row = await db.createAsk({
        ask: askText,
        asker,
        effort: null,
        urgency: null,
        threadLink: threadLink(chatId, msg.message_thread_id, msg.message_id),
        chatId,
        topicId: msg.message_thread_id || null,
        msgId: msg.message_id,
      });

      const sent = await bot.sendMessage(chatId, views.card(row), {
        message_thread_id: msg.message_thread_id,
        parse_mode: 'HTML',
        reply_markup: keyboardFor(row),
      });
      await db.setCardId(row.id, sent.message_id);
    } catch (err) {
      console.error('message handler error:', err.message);
    }
  });
}

module.exports = { register };
