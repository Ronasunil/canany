// In-memory state shared across handlers.
// Outcome capture: `${chatId}:${userId}` -> askId awaiting an outcome reply.
// The callback handler sets it (on ✅ Done); the message handler reads/clears it.
const pendingOutcome = new Map();

// Custom-effort capture: `${chatId}:${userId}` -> askId awaiting a typed effort.
// Set by the callback handler (on ✏️ Custom effort); read/cleared by the message handler.
const pendingEffort = new Map();

module.exports = { pendingOutcome, pendingEffort };
