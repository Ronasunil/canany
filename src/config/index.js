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

// The web UI is opt-in: it only starts when WEB_PASSWORD is set, so bot-only
// installs keep working untouched. When it IS enabled we hard-require a
// SESSION_SECRET — without it the login cookie can't be signed safely.
const webEnabled = Boolean(process.env.WEB_PASSWORD);
if (webEnabled) need('SESSION_SECRET');

const config = Object.freeze({
  telegram: {
    token: process.env.BOT_TOKEN,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  behavior: {
    askPrefix: process.env.ASK_PREFIX || '#ask',
    // Fall back to 2 if STALLED_DAYS is missing or not a positive number,
    // so a typo can't silently break /stalled with a NaN date cutoff.
    stalledDays: (() => {
      const n = Number(process.env.STALLED_DAYS);
      return Number.isFinite(n) && n > 0 ? n : 2;
    })(),
  },
  // Read-only web board behind a single shared password (see src/infrastructure/web).
  web: {
    enabled: webEnabled,
    port: (() => {
      const n = Number(process.env.WEB_PORT);
      return Number.isFinite(n) && n > 0 ? n : 8080;
    })(),
    password: process.env.WEB_PASSWORD || null,
    sessionSecret: process.env.SESSION_SECRET || null,
    // Set WEB_SECURE_COOKIE=true once the site is fronted by HTTPS so the login
    // cookie is only ever sent over TLS.
    secureCookie: process.env.WEB_SECURE_COOKIE === 'true',
  },
});

module.exports = config;
