// Attachment plumbing for #ask, kept out of the message handler.
// - extractAttachments(msg): normalize the one media object on a Telegram message
//   into our attachment shape (0 or 1 per message).
// - bufferAlbum(msg, flush): group "album" messages (several files sent together,
//   which Telegram delivers as separate messages sharing a media_group_id — with
//   the #ask caption on just one of them) so they all attach to one ask.

// A single Telegram message carries at most one media object. Returns an array of
// 0 or 1 descriptors — an array so an album's messages can be flat-mapped together.
function extractAttachments(msg) {
  if (!msg) return [];

  // A photo arrives as a list of sizes, smallest -> largest. Take the largest.
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const largest = msg.photo[msg.photo.length - 1];
    return [{
      kind: 'photo',
      tg_file_id: largest.file_id,
      tg_file_unique_id: largest.file_unique_id,
      file_name: null,
      mime_type: 'image/jpeg', // Telegram re-encodes photos to JPEG
      file_size: largest.file_size ?? null,
      width: largest.width ?? null,
      height: largest.height ?? null,
    }];
  }

  const media = msg.document || msg.video || msg.animation || msg.audio || msg.voice;
  if (!media) return [];
  const kind = msg.document ? 'document'
    : msg.video ? 'video'
    : msg.animation ? 'animation'
    : msg.audio ? 'audio'
    : 'voice';
  return [{
    kind,
    tg_file_id: media.file_id,
    tg_file_unique_id: media.file_unique_id,
    file_name: media.file_name ?? null,
    mime_type: media.mime_type ?? null,
    file_size: media.file_size ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
  }];
}

// How long to wait for more members of an album after the last one arrives.
const ALBUM_WINDOW_MS = 1500;

// media_group_id -> { messages: [], timer }. In-memory and best-effort by design:
// this is the one place the app holds state across messages, justified because an
// album is ephemeral — a mid-album restart just drops it (the asker re-sends), and
// nothing correctness-critical (claiming/closing an ask) depends on it. Only
// album messages ever reach here; single messages are handled synchronously.
const albums = new Map();

// Collect messages sharing a media_group_id; once none has arrived for
// ALBUM_WINDOW_MS, hand the whole batch to flush(messages[]).
function bufferAlbum(msg, flush) {
  const key = msg.media_group_id;
  let entry = albums.get(key);
  if (!entry) {
    entry = { messages: [], timer: null };
    albums.set(key, entry);
  }
  entry.messages.push(msg);
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    albums.delete(key);
    Promise.resolve(flush(entry.messages)).catch((err) =>
      console.error('album flush error:', err.message));
  }, ALBUM_WINDOW_MS);
}

module.exports = { extractAttachments, bufferAlbum, ALBUM_WINDOW_MS };
