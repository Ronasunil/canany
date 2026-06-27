// Slash command routing: /connect /board /top /stalled /start /help.
// Boards are org-scoped: a group must be linked (via /connect) before /board,
// /top, /stalled show anything. /start and /help still work in DMs for onboarding.
const config = require('../config');
const db = require('../infrastructure/db/asksRepository');
const groups = require('../infrastructure/db/groupsRepository');
const tokens = require('../infrastructure/db/tokensRepository');
const views = require('../presentation/views');
const { HTML, HELP, threadOpts } = require('../presentation/keyboards');

const STALLED_DAYS = config.behavior.stalledDays;

function register(bot) {
  bot.on('message', async (msg) => {
    try {
      const text = (msg.text || '').trim();
      if (!text.startsWith('/')) return;

      const cmd = text.split(/[\s@]/)[0].toLowerCase();
      const chatId = msg.chat.id;
      const isPrivate = msg.chat.type === 'private';

      // /connect <token> — link THIS group to the org that minted the token.
      if (cmd === '/connect') {
        if (isPrivate) {
          await bot.sendMessage(chatId, 'Run <code>/connect</code> inside the group you want to link.', HTML);
          return;
        }
        // The shared split() parser above drops args, so pull the token from raw text.
        const m = text.match(/^\/connect(?:@\S+)?\s+(\S+)/i);
        if (!m) {
          await bot.sendMessage(chatId, 'Usage: <code>/connect &lt;token&gt;</code> — get a token from your org page on the web.', threadOpts(msg, HTML));
          return;
        }
        const result = await tokens.consumeToken({ token: m[1], chatId, connectedBy: msg.from && msg.from.id });
        if (result.ok) {
          await bot.sendMessage(chatId, `✅ Verified — connected to <b>${views.esc(result.org.name)}</b>. Board is live.`, threadOpts(msg, HTML));
        } else {
          await bot.sendMessage(chatId, '❌ Invalid or expired token. Grab a fresh one from your org page.', threadOpts(msg, HTML));
        }
        return;
      }

      // Boards are group-only and org-scoped.
      if (cmd === '/board' || cmd === '/top' || cmd === '/stalled') {
        if (isPrivate) {
          await bot.sendMessage(chatId, 'Boards live in your group — run it there. (DM is just for onboarding.)', HTML);
          return;
        }
        const orgId = await groups.orgIdForChat(chatId);
        if (orgId == null) {
          await bot.sendMessage(chatId, "This group isn't connected yet. Run <code>/connect &lt;token&gt;</code> with a token from your org page.", threadOpts(msg, HTML));
          return;
        }
        if (cmd === '/board') {
          await bot.sendMessage(chatId, views.board(await db.listAsks(orgId)), threadOpts(msg, HTML));
        } else if (cmd === '/top') {
          await bot.sendMessage(chatId, views.top(await db.leaderboard(orgId)), threadOpts(msg, HTML));
        } else {
          await bot.sendMessage(chatId, views.stalled(await db.stalledAsks(orgId, STALLED_DAYS), STALLED_DAYS), threadOpts(msg, HTML));
        }
        return;
      }

      if (cmd === '/start' || cmd === '/help') {
        await bot.sendMessage(chatId, HELP, threadOpts(msg, HTML));
      }
    } catch (err) {
      console.error('command handler error:', err.message);
    }
  });
}

module.exports = { register };
