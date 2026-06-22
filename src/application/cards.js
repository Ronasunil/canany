// Re-render the in-thread ask card after a state change. Shared by both handlers.
const views = require('../presentation/views');
const { keyboardFor } = require('../presentation/keyboards');

async function refreshCard(bot, row) {
  if (!row.tg_card_id || !row.tg_chat_id) return;
  const opts = {
    chat_id: row.tg_chat_id,
    message_id: Number(row.tg_card_id),
    parse_mode: 'HTML',
    reply_markup: keyboardFor(row),
  };
  try {
    await bot.editMessageText(views.card(row), opts);
  } catch (err) {
    if (!/not modified/i.test(err.message)) console.warn('editMessageText:', err.message);
  }
}

module.exports = { refreshCard };
