// Telegram message scaffolding: inline keyboard, reply options, display helpers,
// and the static help copy. (Message *bodies* are rendered in views.js.)
const config = require('../config');
const { URGENCIES, EFFORTS } = require('../domain/constants');

const ASK_PREFIX = config.behavior.askPrefix;

const HTML = { parse_mode: 'HTML' };

const HELP =
  '🛠️ <b>Can Anyone</b> — ask openly, anyone grabs it, it gets done.\n\n' +
  `• Post <code>${ASK_PREFIX} your request</code> in the chat to raise an ask.\n` +
  '• As the <b>asker</b>, tap an urgency button (🔴 now · 🟡 EOD · 🟢 no-rush).\n' +
  '• Tap <b>✋ Claim</b> to take it, then pick the <b>effort</b> (~mins · ~hrs · ~days · ~weeks).\n' +
  '• Tap <b>✅ Done</b> to close it with an outcome (you must claim first).\n\n' +
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

// --- inline-keyboard building blocks ---
const URGENCY_EMOJI = { now: '🔴', EOD: '🟡', 'no-rush': '🟢' };

// Asker's urgency picker (one button per allowed urgency).
function urgencyRow(askId) {
  return URGENCIES.map((u) => ({
    text: `${URGENCY_EMOJI[u] || ''} ${u}`.trim(),
    callback_data: `urg:${askId}:${u}`,
  }));
}

// Claimer's effort picker (one button per allowed effort estimate).
function effortRow(askId) {
  return EFFORTS.map((e) => ({ text: e, callback_data: `eff:${askId}:${e}` }));
}

const claimBtn = (id) => ({ text: '✋ Claim', callback_data: `claim:${id}` });
const scopeBtn = (id) => ({ text: '🔍 Scope', callback_data: `scope:${id}` });
const doneBtn = (id) => ({ text: '✅ Done', callback_data: `done:${id}` });
const customEffortBtn = (id) => ({ text: '✏️ Custom effort', callback_data: `eff:${id}:custom` });

// The card's keyboard depends on where the ask is in its lifecycle:
//  - open/scoping  → asker picks urgency (until set), plus Claim/Scope
//  - claimed       → Claim is gone; claimer picks effort (presets or a typed
//                    custom amount, and can keep refining it), plus Done
//  - done          → no buttons
function keyboardFor(row) {
  const id = row.id;
  if (row.status === 'done') return { inline_keyboard: [] };

  if (row.status === 'claimed') {
    return {
      inline_keyboard: [effortRow(id), [customEffortBtn(id)], [doneBtn(id)]],
    };
  }

  // open / scoping
  const rows = [];
  if (!row.urgency) rows.push(urgencyRow(id));
  rows.push([claimBtn(id), scopeBtn(id)]);
  return { inline_keyboard: rows };
}

// Reply options that keep us in the same forum topic when there is one.
function threadOpts(msg, extra = {}) {
  const o = { ...extra };
  if (msg.message_thread_id) o.message_thread_id = msg.message_thread_id;
  return o;
}

module.exports = { HTML, HELP, displayName, threadLink, keyboardFor, threadOpts };
