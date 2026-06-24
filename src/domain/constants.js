// Shared domain vocabulary — the single source of truth for ask statuses and urgencies.
// Imported by the data layer (sorting/queries) and the presentation layer (rendering)
// so the same words aren't redefined in three places.

// The lifecycle of an ask, in order. Also used to sort the board.
const STATUS_ORDER = ['open', 'claimed', 'done'];

// Allowed urgency values (mirrors the CHECK constraint in db/schema.sql).
// Set by the asker via buttons on the ask card.
const URGENCIES = ['now', 'EOD', 'no-rush'];

// Effort the claimer estimates in two taps: first a unit, then a quantity.
// The chosen pair is stored as a human string like "2 days" (singular "1 day").
// Each unit carries the quantity presets shown in the second-step picker.
const EFFORT_UNITS = [
  { key: 'mins', one: 'min', many: 'mins', steps: [5, 10, 15, 30, 45] },
  { key: 'hrs', one: 'hr', many: 'hrs', steps: [1, 2, 3, 4, 6, 8] },
  { key: 'days', one: 'day', many: 'days', steps: [1, 2, 3, 5] },
  { key: 'weeks', one: 'week', many: 'weeks', steps: [1, 2, 3, 4] },
];

const EFFORT_UNIT_KEYS = EFFORT_UNITS.map((u) => u.key);

// Validate + format a unit/quantity pair into the stored effort string, e.g.
// ('days', 2) -> "2 days", ('days', 1) -> "1 day". Returns null when the unit
// is unknown or the quantity isn't one of that unit's presets — so a crafted
// callback can't write an arbitrary effort.
function effortLabel(unitKey, qty) {
  const u = EFFORT_UNITS.find((x) => x.key === unitKey);
  if (!u || !u.steps.includes(qty)) return null;
  return `${qty} ${qty === 1 ? u.one : u.many}`;
}

module.exports = { STATUS_ORDER, URGENCIES, EFFORT_UNITS, EFFORT_UNIT_KEYS, effortLabel };
