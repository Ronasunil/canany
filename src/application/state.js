// In-memory state shared across handlers. Both maps are keyed by the PROMPT
// message: `${chatId}:${promptMsgId}` -> { askId, userId }.
//
// Keying by the prompt id (not the user) means we only consume a message that is
// an actual reply to our force-reply prompt — so unrelated chatter can't be
// mistaken for an outcome/effort — and several prompts can be outstanding at once.
// (In-memory, so a process restart drops any unanswered prompt; acceptable here.)
const pendingOutcome = new Map(); // set on ✅ Done
const pendingEffort = new Map(); // set on ✏️ Custom effort

module.exports = { pendingOutcome, pendingEffort };
