// Pull an attachment's bytes down from Telegram by file_id. Used ONLY at ingest —
// once a file is copied into S3, the serve path never touches Telegram again.
// Uses the shared bot instance and works without polling (it's a plain API call).
const { bot } = require('./client');

// A Node Readable of the file's bytes. Rejects/errors if Telegram can't serve it
// (notably files over the Bot API's ~20MB download limit — callers skip those up
// front via file_size, so this is a backstop).
function getStream(fileId) {
  return bot.getFileStream(fileId);
}

module.exports = { getStream };
