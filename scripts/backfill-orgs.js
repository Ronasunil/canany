// Backfill existing single-tenant data into per-group orgs. Runs LAST — after the
// admin has signed up on the web, so there's a user.id to own the migrated orgs.
//
// This is intentionally NOT a Prisma migration: it's a plain, idempotent,
// dry-runnable, reversible data script that reuses the app's Prisma singleton.
//
// Usage:
//   node scripts/backfill-orgs.js --owner <email|userId> --dry-run   # preview
//   node scripts/backfill-orgs.js --owner <email|userId>             # apply
//   node scripts/backfill-orgs.js --revert                           # undo migrated orgs
//   node scripts/backfill-orgs.js --revert --dry-run                 # preview the undo
//
// Forward: every DISTINCT tg_chat_id among asks with no org becomes its own org
// (reusing an already-linked group's org if one exists), owned by --owner; then
// that chat's null-org asks are stamped with the org id. Idempotent: re-running
// only ever touches asks that are still org-less.
const { prisma } = require('../src/infrastructure/db/prisma');

function parseArgs(argv) {
  const args = { dryRun: false, revert: false, owner: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--revert') args.revert = true;
    else if (a === '--owner') args.owner = argv[++i];
    else if (a.startsWith('--owner=')) args.owner = a.slice('--owner='.length);
  }
  return args;
}

// --owner accepts a numeric user id or an email.
async function resolveOwner(owner) {
  const asId = Number(owner);
  if (Number.isInteger(asId) && String(asId) === String(owner)) {
    return prisma.user.findUnique({ where: { id: asId } });
  }
  return prisma.user.findUnique({ where: { email: String(owner).trim().toLowerCase() } });
}

async function forward({ dryRun, ownerUser }) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT tg_chat_id FROM asks
    WHERE tg_chat_id IS NOT NULL AND org_id IS NULL`;
  const chatIds = rows.map((r) => r.tg_chat_id);
  console.log(`Found ${chatIds.length} group(s) with un-orged asks.\n`);

  let created = 0, reused = 0, stamped = 0;
  for (const chatId of chatIds) {
    const toStamp = await prisma.ask.count({ where: { tg_chat_id: chatId, org_id: null } });
    const existing = await prisma.group.findUnique({ where: { tg_chat_id: chatId } });

    if (dryRun) {
      if (existing) {
        console.log(`  [dry] ${chatId}: reuse org #${existing.org_id}, stamp ${toStamp} ask(s)`);
        reused++;
      } else {
        console.log(`  [dry] ${chatId}: CREATE org "Migrated group ${chatId}" (owner #${ownerUser.id}), stamp ${toStamp} ask(s)`);
        created++;
      }
      stamped += toStamp;
      continue;
    }

    // One transaction per chat: create-or-reuse the org, then stamp its asks.
    const result = await prisma.$transaction(async (tx) => {
      let orgId, didCreate = false;
      if (existing) {
        orgId = existing.org_id;
      } else {
        const org = await tx.org.create({
          data: { name: `Migrated group ${chatId}`, origin: 'migrated', owner_user_id: ownerUser.id },
        });
        await tx.group.create({ data: { tg_chat_id: chatId, org_id: org.id } });
        orgId = org.id;
        didCreate = true;
      }
      const { count } = await tx.ask.updateMany({
        where: { tg_chat_id: chatId, org_id: null },
        data: { org_id: orgId },
      });
      return { orgId, didCreate, count };
    });

    if (result.didCreate) created++; else reused++;
    stamped += result.count;
    console.log(`  ${chatId}: org #${result.orgId} ${result.didCreate ? '(created)' : '(reused)'} — stamped ${result.count} ask(s)`);
  }

  console.log(`\n${dryRun ? 'DRY RUN — nothing changed. ' : ''}Orgs created: ${created}, reused: ${reused}, asks stamped: ${stamped}.`);
}

async function revert({ dryRun }) {
  const migrated = await prisma.org.findMany({ where: { origin: 'migrated' } });
  console.log(`Found ${migrated.length} migrated org(s).\n`);
  const ids = migrated.map((o) => o.id);
  if (!ids.length) return;

  if (dryRun) {
    for (const o of migrated) {
      const n = await prisma.ask.count({ where: { org_id: o.id } });
      console.log(`  [dry] org #${o.id} "${o.name}": null ${n} ask(s), delete its groups + token(s) + the org`);
    }
    console.log('\nDRY RUN — nothing changed.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.ask.updateMany({ where: { org_id: { in: ids } }, data: { org_id: null } });
    await tx.group.deleteMany({ where: { org_id: { in: ids } } });
    await tx.connectToken.deleteMany({ where: { org_id: { in: ids } } });
    await tx.org.deleteMany({ where: { id: { in: ids } } });
  });
  console.log(`Reverted ${ids.length} migrated org(s): asks un-stamped, groups/tokens/orgs removed.`);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args.revert) {
      await revert({ dryRun: args.dryRun });
    } else {
      if (!args.owner) {
        console.error('Forward backfill requires --owner <email|userId>. (Use --revert to undo.)');
        process.exitCode = 1;
        return;
      }
      const ownerUser = await resolveOwner(args.owner);
      if (!ownerUser) {
        console.error(`No user found for --owner "${args.owner}". Sign up on the web first, then re-run.`);
        process.exitCode = 1;
        return;
      }
      console.log(`Owner: #${ownerUser.id} <${ownerUser.email}>${args.dryRun ? '  (dry run)' : ''}\n`);
      await forward({ dryRun: args.dryRun, ownerUser });
    }
  } catch (err) {
    console.error('Backfill failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
