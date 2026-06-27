// Data-access for the chat<->org link (the `groups` table). The bot calls
// orgIdForChat on every board/ask path to resolve which org a chat belongs to.
const { prisma } = require('./prisma');

// The single group->org resolver. Returns the org id for a chat, or null when
// the chat has never been connected (the caller then prompts for /connect).
async function orgIdForChat(chatId) {
  const row = await prisma.group.findUnique({ where: { tg_chat_id: String(chatId) } });
  return row ? row.org_id : null;
}

async function getGroupByChatId(chatId) {
  return prisma.group.findUnique({ where: { tg_chat_id: String(chatId) } });
}

// Link (or re-point) a chat to an org. consumeToken does its own upsert during
// /connect; this is the reusable form (used by the backfill / future call sites).
async function linkGroup({ chatId, orgId, connectedBy, title }) {
  const connectedByStr = connectedBy == null ? null : String(connectedBy);
  const data = { org_id: orgId, connected_by: connectedByStr, connected_at: new Date() };
  if (title !== undefined) data.title = title;
  return prisma.group.upsert({
    where: { tg_chat_id: String(chatId) },
    create: { tg_chat_id: String(chatId), ...data },
    update: data,
  });
}

module.exports = { orgIdForChat, getGroupByChatId, linkGroup };
