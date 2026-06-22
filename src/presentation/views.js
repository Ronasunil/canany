// Renders Telegram messages. Tables are monospace <pre> blocks so columns align.
// We pad to a fixed width FIRST, then HTML-escape — so '<','>','&' don't break alignment
// (Telegram renders the escaped entity as a single visible character).
const { STATUS_ORDER } = require('../domain/constants');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Count/slice by code points, not UTF-16 units, so an emoji or other
// astral-plane char counts as one cell and truncation never splits a surrogate
// pair into a � replacement char.
function pad(s, n) {
  const chars = Array.from(String(s == null ? '' : s));
  if (chars.length > n) return chars.slice(0, n - 1).join('') + '…';
  return chars.join('') + ' '.repeat(n - chars.length);
}

// Truncate to at most n code points (no padding) — for the free-width last column.
function clip(s, n) {
  const chars = Array.from(String(s == null ? '' : s));
  return chars.length > n ? chars.slice(0, n - 1).join('') + '…' : chars.join('');
}

function preTable(headerLine, bodyLines) {
  return '<pre>' + esc([headerLine, ...bodyLines].join('\n')) + '</pre>';
}

// Join cells with a single space; pad all but the last cell to fixed widths.
// The join always leaves a gap, so a truncated cell never touches the next column.
function cols(cells, widths) {
  return cells.map((c, i) => (i === cells.length - 1 ? String(c) : pad(c, widths[i]))).join(' ');
}

function who(claimer) {
  return claimer ? '@' + claimer : '—';
}

function id(n) {
  return '#' + String(n).padStart(2, '0');
}

// Single-width glyphs (BMP code points, so monospace alignment stays intact).
const STATUS_GLYPH = { open: '○', claimed: '◑', done: '✓' };
function statusCell(s) {
  return `${STATUS_GLYPH[s] || '•'} ${s}`;
}

// ---- /board ----
// Scan grid (# ASK URG EFF STATUS WHO OUTCOME). OUTCOME is the free-width last
// column (clipped); the full record — asker, outcome text, clickable thread
// link — also lives on each ask's card (see card()). EFF is wide enough for a
// quantified effort like '12 hrs'.
function board(rows) {
  if (!rows.length) {
    return '📋 <b>canany — board</b>\n\nNo asks yet. Post one with #ask to get started.';
  }
  const W = [3, 16, 7, 9, 9, 8];
  const header = cols(['#', 'ASK', 'URG', 'EFF', 'STATUS', 'WHO', 'OUTCOME'], W);
  const body = rows.map((r) =>
    cols([id(r.id), r.ask, r.urgency || '—', r.effort || '—', statusCell(r.status), who(r.claimer), clip(r.outcome || '—', 28)], W)
  );
  const counts = STATUS_ORDER
    .map((s) => `${rows.filter((r) => r.status === s).length} ${s}`)
    .join(' · ');
  return '📋 <b>canany — board</b>\n' + preTable(header, body) + `\n<i>${rows.length} asks · ${counts}</i>`;
}

// ---- /top ----
function top(stats) {
  if (!stats.length) {
    return '🏆 <b>canany — top builders</b>\n\nNo closed asks yet — the board fills up as things get done.';
  }
  const W = [2, 13, 5, 5];
  const header = cols(['#', 'BUILDER', 'SHIP', 'HELP', 'ASK'], W);
  const body = stats.map((s, i) =>
    cols(['#' + (i + 1), '@' + s.person, s.shipped, s.helped, s.raised], W)
  );
  return '🏆 <b>canany — top builders (this month)</b>\n' + preTable(header, body);
}

// ---- /stalled ----
function stalled(rows, days) {
  if (!rows.length) {
    return `⏱ <b>canany — stalled</b>\n\n✅ Nothing stalled — no asks open longer than ${days} days.`;
  }
  const W = [3, 24, 5, 8];
  const header = cols(['#', 'ASK', 'AGE', 'STATUS', 'ASKER'], W);
  const body = rows.map((r) => {
    const ageDays = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
    return cols([id(r.id), r.ask, ageDays + 'd', r.status, '@' + r.asker], W);
  });
  return `⏱ <b>canany — stalled (&gt; ${days}d)</b>\n` + preTable(header, body);
}

// ---- the in-thread ask card (with the buttons) ----
function card(r) {
  const lines = [
    `🛠️ <b>Ask #${r.id}</b> — ${esc(r.ask)}`,
    `from @${esc(r.asker)}  ·  effort: <b>${esc(r.effort || '—')}</b>  ·  urgency: ${esc(r.urgency || '—')}`,
    `status: <b>${esc(r.status)}</b>${r.claimer ? `  ·  ✋ @${esc(r.claimer)}` : ''}`,
  ];
  if (r.outcome) lines.push(`✅ outcome: ${esc(r.outcome)}`);
  if (r.thread_link) lines.push(`🔗 <a href="${esc(r.thread_link)}">thread</a>`);
  return lines.join('\n');
}

module.exports = { board, top, stalled, card, esc };
