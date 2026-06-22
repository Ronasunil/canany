// The single source of truth for environment configuration.
// Loaded (and validated) once here; every other module imports this object
// instead of touching process.env directly.
require('dotenv').config();

// Hard requirement — exit early with a friendly hint if a critical var is missing.
function need(key) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}
need('BOT_TOKEN');
need('DATABASE_URL');

const config = Object.freeze({
  telegram: {
    token: process.env.BOT_TOKEN,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  behavior: {
    askPrefix: process.env.ASK_PREFIX || '#ask',
    stalledDays: Number(process.env.STALLED_DAYS || 2),
  },
});

module.exports = config;
