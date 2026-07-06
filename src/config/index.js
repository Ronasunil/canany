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

// The web UI is now the product front door (signup -> org -> connect token), so
// it's on by default. Opt out for a pure-bot deploy with WEB_ENABLED=false.
// When the web is on we hard-require SESSION_SECRET (to sign the session cookie)
// and BOT_USERNAME (for the "add the bot to your group" deep link on the org page).
const webEnabled = process.env.WEB_ENABLED !== 'false';
if (webEnabled) {
  need('SESSION_SECRET');
  need('BOT_USERNAME');
}

const config = Object.freeze({
  telegram: {
    token: process.env.BOT_TOKEN,
    // Used to build https://t.me/<botUsername>?startgroup=true. Stored without a
    // leading @ so the link is always well-formed.
    botUsername: (process.env.BOT_USERNAME || '').replace(/^@/, '') || null,
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
  // The multi-tenant web board: accounts, orgs, and per-org boards (see src/infrastructure/web).
  web: {
    enabled: webEnabled,
    port: (() => {
      const n = Number(process.env.WEB_PORT);
      return Number.isFinite(n) && n > 0 ? n : 8080;
    })(),
    sessionSecret: process.env.SESSION_SECRET || null,
    // Optional bootstrap kill-switch: when set, signup additionally requires this
    // code (gate to invited users). Unset (the default) = open signup.
    signupCode: process.env.SIGNUP_CODE || null,
    // Set WEB_SECURE_COOKIE=true once the site is fronted by HTTPS so the session
    // cookie is only ever sent over TLS.
    secureCookie: process.env.WEB_SECURE_COOKIE === 'true',
  },
  // Object storage for #ask attachments (see src/infrastructure/storage). When
  // S3_BUCKET/AWS_REGION are unset, `enabled` is false and attachment capture is
  // skipped — asks still work text-only, so a pure-bot deploy needs no S3.
  // AWS credentials are resolved by the SDK's default provider chain (IAM instance
  // role in prod, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY locally) — never read here.
  storage: (() => {
    const awsRegion = process.env.AWS_REGION || null;
    const s3Bucket = process.env.S3_BUCKET || null;
    return { awsRegion, s3Bucket, enabled: Boolean(awsRegion && s3Bucket) };
  })(),
});

module.exports = config;
