// The Telegram bot client: the bot instance, command menu, polling, and topic posts.
// Handlers live in src/application and are registered against this `bot` by index.js.
const TelegramBot = require('node-telegram-bot-api');
const config = require('../../config');

// polling:false here — index.js starts polling after the DB connection is ready.
const bot = new TelegramBot(config.telegram.token, { polling: false });

bot.on('polling_error', (err) => console.error('Polling error:', err.message));

async function startPolling() {
  await bot.setMyCommands([
    { command: 'connect', description: 'Link this group to your org' },
    { command: 'board', description: 'Show the asks board' },
    { command: 'top', description: 'Top builders this month' },
    { command: 'stalled', description: 'Asks open too long' },
    { command: 'help', description: 'How Can Anyone works' },
  ]).catch(() => {});
  await bot.startPolling();
  console.log('Bot polling started.');
}

module.exports = { bot, startPolling };
