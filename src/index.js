// Composition root. Boot order matters:
// load+validate config -> connect Prisma -> wire handlers -> start polling.
// The schema is applied by Prisma migrations (npm run db:dev / prisma:migrate),
// not on boot — so the database + tables must exist before starting.
require('./config'); // requiring this validates env and exits if BOT_TOKEN/DATABASE_URL are missing.

const { prisma } = require('./infrastructure/db/prisma');
const { bot, startPolling } = require('./infrastructure/telegram/client');
const messageHandler = require('./application/handlers/message');
const callbackHandler = require('./application/handlers/callback');
const commands = require('./application/commands');

(async () => {
  // Fail fast with a clear error if the database isn't reachable / created yet.
  await prisma.$connect();
  console.log('Database connected.');

  // Attach all Telegram listeners before polling begins.
  messageHandler.register(bot);
  callbackHandler.register(bot);
  commands.register(bot);

  await startPolling();
  console.log('✅ canany is running — post a #ask message, then try /board.');
})().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});

// Close the Prisma connection cleanly on shutdown (pm2 restart, Ctrl+C, etc.).
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down.`);
  try { await prisma.$disconnect(); } catch (_) {}
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});
