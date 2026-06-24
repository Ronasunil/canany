// Shared domain vocabulary — the single source of truth for ask statuses and urgencies.
// Imported by the data layer (sorting/queries) and the presentation layer (rendering)
// so the same words aren't redefined in three places.

// The lifecycle of an ask, in order. Also used to sort the board.
const STATUS_ORDER = ['open', 'claimed', 'done'];

// Allowed urgency values (mirrors the CHECK constraint in db/schema.sql).
// Set by the asker via buttons on the ask card.
const URGENCIES = ['now', 'EOD', 'no-rush'];

// Effort estimates the claimer picks from (once claimed); tapping one sets the
// effort directly (e.g. "~hrs") and re-renders the card.
const EFFORTS = ['~mins', '~hrs', '~days', '~weeks'];

module.exports = { STATUS_ORDER, URGENCIES, EFFORTS };
