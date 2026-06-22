// Slash command routing: /board /top /stalled /start /help.
// Works in the topic, the wider group, or a DM.
const config = require('../config');
const db = require('../infrastructure/db/asksRepository');
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

      if (cmd === '/board') {
        await bot.sendMessage(chatId, views.board(await db.listAsks()), threadOpts(msg, HTML));
      } else if (cmd === '/top') {
        await bot.sendMessage(chatId, views.top(await db.leaderboard()), threadOpts(msg, HTML));
      } else if (cmd === '/stalled') {
        await bot.sendMessage(chatId, views.stalled(await db.stalledAsks(STALLED_DAYS), STALLED_DAYS), threadOpts(msg, HTML));
      } else if (cmd === '/start' || cmd === '/help') {
        await bot.sendMessage(chatId, HELP, threadOpts(msg, HTML));
      }
    } catch (err) {
      console.error('command handler error:', err.message);
    }
  });
}

module.exports = { register };
