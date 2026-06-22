// In-memory state shared across handlers.
// Outcome capture: `${chatId}:${userId}` -> askId awaiting an outcome reply.
// The callback handler sets it (on ✅ Done); the message handler reads/clears it.
const pendingOutcome = new Map();

module.exports = { pendingOutcome };
