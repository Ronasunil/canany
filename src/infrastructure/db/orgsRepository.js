// Data-access for tenants (the `orgs` table) and the org owner's view of connect
// tokens. The low-level token mint/burn lives in tokensRepository; this repo wraps
// it with the org-owner operations the web UI needs (create / regenerate / display).
const { prisma } = require('./prisma');
const tokens = require('./tokensRepository');

async function createOrg({ name, ownerUserId, origin = 'web' }) {
  return prisma.org.create({
    data: { name, owner_user_id: ownerUserId ?? null, origin },
  });
}

// Returns the org including owner_user_id, so the route layer can do the
// ownership check (owner_user_id === req.user.id) before showing it.
async function getOrg(id) {
  return prisma.org.findUnique({ where: { id } });
}

async function listOrgsByUser(userId) {
  return prisma.org.findMany({
    where: { owner_user_id: userId },
    orderBy: { created_at: 'asc' },
  });
}

async function createConnectToken(orgId) {
  return tokens.createToken({ orgId });
}

// Burn every outstanding unused token for the org, then mint a fresh one — so a
// regenerate truly invalidates a previously-shared (possibly leaked) token.
async function regenerateConnectToken(orgId) {
  await prisma.connectToken.updateMany({
    where: { org_id: orgId, used_at: null },
    data: { used_at: new Date() },
  });
  return tokens.createToken({ orgId });
}

// The unused, unexpired token to DISPLAY on the org page. Read-only: a page load
// must never mint a token (only POST /orgs and POST /orgs/:id/token do).
async function getActiveConnectToken(orgId) {
  return prisma.connectToken.findFirst({
    where: { org_id: orgId, used_at: null, expires_at: { gt: new Date() } },
    orderBy: { created_at: 'desc' },
  });
}

async function listGroupsByOrg(orgId) {
  return prisma.group.findMany({
    where: { org_id: orgId },
    orderBy: { created_at: 'asc' },
  });
}

module.exports = {
  createOrg, getOrg, listOrgsByUser,
  createConnectToken, regenerateConnectToken, getActiveConnectToken,
  listGroupsByOrg,
};
