// Telegram message scaffolding: inline keyboard, reply options, display helpers,
// and the static help copy. (Message *bodies* are rendered in views.js.)
const config = require('../config');
const { URGENCIES, EFFORT_UNITS } = require('../domain/constants');

const ASK_PREFIX = config.behavior.askPrefix;

const HTML = { parse_mode: 'HTML' };

const HELP =
  '🛠️ <b>Can Anyone</b> — ask openly, anyone grabs it, it gets done.\n\n' +
  `• Post <code>${ASK_PREFIX} your request</code> in the chat to raise an ask.\n` +
  '• As the <b>asker</b>, tap an urgency button (🔴 now · 🟡 EOD · 🟢 no-rush).\n' +
  '• Tap <b>✋ Claim</b> to take it, then tap an <b>effort</b> unit (~mins · ~hrs · ~days · ~weeks) and a quantity (e.g. 2 days).\n' +
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

// Claimer's effort picker, step 1: one button per unit. Tapping a unit doesn't
// set the effort yet — it swaps in the quantity picker below (see callback.js).
function effortRow(askId) {
  return EFFORT_UNITS.map((u) => ({ text: `~${u.many}`, callback_data: `eff:${askId}:${u.key}` }));
}

// Step 2: quantity picker for a chosen unit. Each button sets the effort
// outright (e.g. "2 days"); ← back returns to the unit picker. Quantities are
// chunked so a wide unit (hrs) doesn't crowd one row on a phone.
function effortQtyKeyboard(askId, unitKey) {
  const u = EFFORT_UNITS.find((x) => x.key === unitKey);
  if (!u) return null;
  const btns = u.steps.map((n) => ({
    text: `${n} ${n === 1 ? u.one : u.many}`,
    callback_data: `effq:${askId}:${u.key}:${n}`,
  }));
  const rows = [];
  for (let i = 0; i < btns.length; i += 4) rows.push(btns.slice(i, i + 4));
  rows.push([{ text: '← back', callback_data: `effback:${askId}` }]);
  return { inline_keyboard: rows };
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
//  - claimed  → Claim is gone; claimer picks an effort unit then a quantity
//               (re-pick any time to change it), plus Done
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

module.exports = { HTML, HELP, displayName, threadLink, keyboardFor, effortQtyKeyboard, threadOpts, outcomePrompt, parseOutcomePrompt };
