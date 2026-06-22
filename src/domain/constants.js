// Shared domain vocabulary — the single source of truth for ask statuses and urgencies.
// Imported by the data layer (sorting/queries) and the presentation layer (rendering)
// so the same words aren't redefined in three places.

// The lifecycle of an ask, in order. Also used to sort the board.
const STATUS_ORDER = ['open', 'scoping', 'claimed', 'done'];

// Allowed urgency values (mirrors the CHECK constraint in db/schema.sql).
const URGENCIES = ['now', 'EOD', 'no-rush'];

module.exports = { STATUS_ORDER, URGENCIES };
