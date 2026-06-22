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
      const replyId = msg.reply_to_message?.message_id;

      // 1) Replies to our force-reply prompts. We only consume a message that is
      //    an actual reply to the prompt AND from the user who was prompted — so
      //    unrelated chatter can never be mistaken for an effort/outcome.
      if (replyId && !text.startsWith('/')) {
        const key = `${chatId}:${replyId}`;

        // 1a) Custom-effort reply (after tapping ✏️ Custom effort).
        if (pendingEffort.has(key)) {
          const { askId, userId } = pendingEffort.get(key);
          if (msg.from.id !== userId) return;
          pendingEffort.delete(key);
          const effort = text.slice(0, 40);
          const row = await db.setEffort(askId, effort);
          if (row) {
            await refreshCard(bot, row);
            await bot.sendMessage(chatId, `✅ Effort for ask ${askId} is ${effort}`, threadOpts(msg));
          } else {
            await bot.sendMessage(chatId, `Couldn't set effort for ask #${askId} — it may have changed.`, threadOpts(msg));
          }
          return;
        }

        // 1b) Outcome reply that closes a claimed ask.
        if (pendingOutcome.has(key)) {
          const { askId, userId } = pendingOutcome.get(key);
          if (msg.from.id !== userId) return;
          pendingOutcome.delete(key);
          const row = await db.doneAsk(askId, text);
          if (row) {
            await refreshCard(bot, row);
            await bot.sendMessage(chatId, `✅ Ask #${askId} closed. Outcome saved.`, threadOpts(msg));
          } else {
            await bot.sendMessage(chatId, `Couldn't close ask #${askId} — it may have changed.`, threadOpts(msg));
          }
          return;
        }
      }

      // 2) Slash commands are routed by ../commands.js — ignore them here.
      if (text.startsWith('/')) return;

      // 3) New ask — the prefix as its own word, followed by an actual request.
      if (!text.startsWith(ASK_PREFIX)) return;
      const rest = text.slice(ASK_PREFIX.length);
      if (rest && !/^\s/.test(rest)) return; // "#asking ..." is not an ask
      const askText = rest.trim();
      if (!askText) return; // bare "#ask" with no body

      const asker = displayName(msg.from);

      // Effort and urgency start empty: the asker sets urgency and the claimer
      // sets effort, both via buttons on the card (no auto-guessing).
      const row = await db.createAsk({
        ask: askText,
        asker,
        askerId: msg.from.id,
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
