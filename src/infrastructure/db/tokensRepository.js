// Data-access for one-time connect tokens (the `connect_tokens` table).
// A token is a short-lived bearer the org owner shows in the web UI; running
// `/connect <token>` in a Telegram group burns it and links that chat to the org.
const crypto = require('crypto');
const { prisma } = require('./prisma');

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Mint a fresh token. base64url of 18 random bytes = 24 url-safe chars (~144 bits)
// — stored in plaintext because it's short-lived and single-use (not a password).
async function createToken({ orgId, ttlMs = DEFAULT_TTL_MS }) {
  const token = crypto.randomBytes(18).toString('base64url');
  return prisma.connectToken.create({
    data: {
      token,
      org_id: orgId,
      expires_at: new Date(Date.now() + ttlMs),
    },
  });
}

// Single-use, race-safe burn. The guarded updateMany (used_at IS NULL AND not
// expired) means exactly one concurrent /connect wins — same idiom as
// guardedTransition in asksRepository. On success the chat is linked (or
// re-pointed) to the token's org via an upsert keyed on tg_chat_id.
async function consumeToken({ token, chatId, connectedBy }) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.connectToken.updateMany({
      where: { token, used_at: null, expires_at: { gt: now } },
      data: { used_at: now, used_by_chat_id: String(chatId) },
    });
    if (count === 0) return { ok: false, reason: 'invalid_or_expired' };

    const row = await tx.connectToken.findUnique({ where: { token } });
    const orgId = row.org_id;
    const connectedByStr = connectedBy == null ? null : String(connectedBy);

    // tg_chat_id is unique: upsert re-points an already-connected group to the
    // new org (last valid connect wins). Past asks keep their original org_id.
    await tx.group.upsert({
      where: { tg_chat_id: String(chatId) },
      create: {
        tg_chat_id: String(chatId),
        org_id: orgId,
        connected_by: connectedByStr,
        connected_at: now,
      },
      update: {
        org_id: orgId,
        connected_by: connectedByStr,
        connected_at: now,
      },
    });

    const org = await tx.org.findUnique({ where: { id: orgId } });
    return { ok: true, org };
  });
}

module.exports = { createToken, consumeToken };
