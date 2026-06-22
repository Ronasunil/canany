// Data-access layer for the `asks` table — Prisma client, same function
// signatures and snake_case return shape the rest of the app already expects.
const { prisma } = require('./prisma');
const { STATUS_ORDER } = require('../../domain/constants');

// Telegram ids are stored as text. null/undefined stays null.
const str = (v) => (v === null || v === undefined ? null : String(v));

// Run a guarded status change: only flips when the ask is in an allowed state.
// Mirrors the old `UPDATE ... WHERE status IN (...)` guard. Returns the updated
// row, or null when the transition wasn't allowed (already taken/closed).
async function guardedTransition(id, fromStatuses, data) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.ask.updateMany({
      where: { id, status: { in: fromStatuses } },
      data,
    });
    if (count === 0) return null;
    return tx.ask.findUnique({ where: { id } });
  });
}

async function createAsk({ ask, asker, effort, urgency, threadLink, chatId, topicId, msgId }) {
  return prisma.ask.create({
    data: {
      ask,
      asker,
      effort,
      urgency,
      thread_link: str(threadLink),
      tg_chat_id: str(chatId),
      tg_topic_id: str(topicId),
      tg_msg_id: str(msgId),
    },
  });
}

async function setCardId(id, cardId) {
  await prisma.ask.update({ where: { id }, data: { tg_card_id: str(cardId) } });
}

async function getAsk(id) {
  return prisma.ask.findUnique({ where: { id } });
}

// open/scoping -> claimed. Returns null if it wasn't claimable.
async function claimAsk(id, who) {
  return guardedTransition(id, ['open', 'scoping'], {
    status: 'claimed',
    claimer: who,
    claimed_at: new Date(),
  });
}

// open -> scoping. Returns null if not open.
async function scopeAsk(id) {
  return guardedTransition(id, ['open'], { status: 'scoping' });
}

// claimed -> done. Returns null if not currently claimed.
async function doneAsk(id, outcome) {
  return guardedTransition(id, ['claimed'], {
    status: 'done',
    outcome,
    closed_at: new Date(),
  });
}

// All asks, sorted by lifecycle (open -> scoping -> claimed -> done) then age.
async function listAsks() {
  const rows = await prisma.ask.findMany({ orderBy: { created_at: 'asc' } });
  const rank = (s) => {
    const i = STATUS_ORDER.indexOf(s);
    return i === -1 ? STATUS_ORDER.length : i;
  };
  // Stable sort keeps created_at order within each status group.
  return rows.sort((a, b) => rank(a.status) - rank(b.status));
}

async function stalledAsks(days) {
  const cutoff = new Date(Date.now() - days * 86400000);
  return prisma.ask.findMany({
    where: { status: { in: ['open', 'scoping'] }, created_at: { lt: cutoff } },
    orderBy: { created_at: 'asc' },
  });
}

// Builders for the current calendar month. Kept as raw SQL — the UNION ALL +
// FILTER + date_trunc shape isn't worth expressing in the query builder.
async function leaderboard() {
  return prisma.$queryRaw`
    SELECT person,
           COUNT(*) FILTER (WHERE kind='shipped') AS shipped,
           COUNT(*) FILTER (WHERE kind='helped')  AS helped,
           COUNT(*) FILTER (WHERE kind='raised')  AS raised
    FROM (
      SELECT claimer AS person, 'shipped' AS kind FROM asks
        WHERE status='done' AND claimer IS NOT NULL
          AND closed_at >= date_trunc('month', now())
      UNION ALL
      SELECT claimer AS person, 'helped' AS kind FROM asks
        WHERE status IN ('claimed','scoping') AND claimer IS NOT NULL
      UNION ALL
      SELECT asker AS person, 'raised' AS kind FROM asks
        WHERE asker IS NOT NULL
          AND created_at >= date_trunc('month', now())
    ) t
    WHERE person IS NOT NULL AND person <> ''
    GROUP BY person
    ORDER BY shipped DESC, helped DESC, raised DESC
    LIMIT 15`;
}

module.exports = {
  createAsk, setCardId, getAsk,
  claimAsk, scopeAsk, doneAsk, listAsks, stalledAsks,
  leaderboard,
};
