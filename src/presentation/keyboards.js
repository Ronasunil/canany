// Telegram message scaffolding: inline keyboard, reply options, display helpers,
// and the static help copy. (Message *bodies* are rendered in views.js.)
const config = require('../config');

const ASK_PREFIX = config.behavior.askPrefix;

const HTML = { parse_mode: 'HTML' };

const HELP =
  '🛠️ <b>Can Anyone</b> — ask openly, anyone grabs it, it gets done.\n\n' +
  `• Post <code>${ASK_PREFIX} your request</code> in the chat to raise an ask.\n` +
  '• Tap <b>✋ Claim</b> to take it, <b>✅ Done</b> to close it (you must claim first).\n\n' +
  'Commands:\n' +
  '/board — current asks\n' +
  '/top — top builders this month\n' +
  '/stalled — asks open too long';

function displayName(user) {
  return user.username || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'someone';
}

function threadLink(chatId, topicId, msgId) {
  const s = String(chatId);
  if (s.startsWith('-100') && topicId) return `https://t.me/c/${s.slice(4)}/${topicId}/${msgId}`;
  return null;
}

function keyboard(askId) {
  return {
    inline_keyboard: [[
      { text: '✋ Claim', callback_data: `claim:${askId}` },
      { text: '🔍 Scope', callback_data: `scope:${askId}` },
      { text: '✅ Done', callback_data: `done:${askId}` },
    ]],
  };
}

// Reply options that keep us in the same forum topic when there is one.
function threadOpts(msg, extra = {}) {
  const o = { ...extra };
  if (msg.message_thread_id) o.message_thread_id = msg.message_thread_id;
  return o;
}

module.exports = { HTML, HELP, displayName, threadLink, keyboard, threadOpts };
