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
  '• Tap <b>✋ Claim</b> to take it, then tap an <b>effort</b> estimate (~mins · ~hrs · ~days · ~weeks).\n' +
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
const doneBtn = (id) => ({ text: '✅ Done', callback_data: `done:${id}` });

// The ✅ Done force-reply prompt. The wording also carries the ask id so a reply
// can be matched back to its ask without any in-memory state (survives restarts):
// outcomePrompt() builds it, parseOutcomePrompt() reads the id back out.
const outcomePrompt = (actor, id) =>
  `@${actor} reply to this with the outcome (a link or what you learned) to close ask #${id}.`;

function parseOutcomePrompt(text) {
  const m = /close ask #(\d+)/i.exec(text || '');
  return m ? Number(m[1]) : null;
}

// The card's keyboard depends on where the ask is in its lifecycle:
//  - open     → asker picks urgency (until set), plus Claim
//  - claimed  → Claim is gone; claimer taps an effort estimate (set directly,
//               re-tap to change it), plus Done
//  - done     → no buttons
function keyboardFor(row) {
  const id = row.id;
  if (row.status === 'done') return { inline_keyboard: [] };

  if (row.status === 'claimed') {
    const rows = [];
    if (!row.urgency) rows.push(urgencyRow(id)); // asker can still set it post-claim
    rows.push(effortRow(id), [doneBtn(id)]);
    return { inline_keyboard: rows };
  }

  // open
  const rows = [];
  if (!row.urgency) rows.push(urgencyRow(id));
  rows.push([claimBtn(id)]);
  return { inline_keyboard: rows };
}

// Reply options that keep us in the same forum topic when there is one.
function threadOpts(msg, extra = {}) {
  const o = { ...extra };
  if (msg.message_thread_id) o.message_thread_id = msg.message_thread_id;
  return o;
}

module.exports = { HTML, HELP, displayName, threadLink, keyboardFor, threadOpts, outcomePrompt, parseOutcomePrompt };
