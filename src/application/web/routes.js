// Web routes for the read-only board. Mounted by src/infrastructure/web/server.js.
// Mirrors the Telegram side: this is the "what happens on each request" layer,
// it reuses the same asksRepository the bot commands do.
const crypto = require('crypto');
const config = require('../../config');
const asks = require('../../infrastructure/db/asksRepository');
const { STATUS_ORDER } = require('../../domain/constants');

// Constant-time password check. timingSafeEqual needs equal-length buffers, so
// we compare fixed-length SHA-256 digests — this also avoids leaking the
// password length through the comparison's timing.
function passwordMatches(input) {
  const expected = config.web.password || '';
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Gate for everything that shows data. Unauthenticated requests bounce to /login.
function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.redirect('/login');
}

function register(app) {
  // Liveness probe — no auth, so an uptime checker can hit it without a session.
  app.get('/healthz', (_req, res) => res.type('text').send('ok'));

  app.get('/login', (req, res) => {
    if (req.session && req.session.authed) return res.redirect('/');
    res.render('login', { error: null });
  });

  app.post('/login', (req, res) => {
    if (passwordMatches(req.body.password)) {
      req.session.authed = true;
      return res.redirect('/');
    }
    res.status(401).render('login', { error: 'Wrong password. Try again.' });
  });

  app.post('/logout', (req, res) => {
    req.session = null;
    res.redirect('/login');
  });

  // Single tabbed page. The active tab (and, for the board, the status filter)
  // come from the query string so each "tab" is just a server-rendered link —
  // no client JS. Each tab reuses the same asksRepository the bot commands do.
  const TABS = ['board', 'top', 'stalled'];
  const STATUS_FILTERS = [...STATUS_ORDER, 'all'];

  app.get('/', requireAuth, async (req, res, next) => {
    try {
      // Anything unrecognised falls back to the default, so a hand-edited query
      // string can never 500 the page.
      const tab = TABS.includes(req.query.tab) ? req.query.tab : 'board';
      const data = { tab };

      if (tab === 'board') {
        // Same rows the Telegram /board renders (open -> claimed -> done).
        const rows = await asks.listAsks();
        // Counts are over the FULL set so the chips always show real totals,
        // independent of which filter is active.
        data.counts = STATUS_ORDER.map((s) => ({
          status: s,
          n: rows.filter((r) => r.status === s).length,
        }));
        data.total = rows.length;
        const status = STATUS_FILTERS.includes(req.query.status) ? req.query.status : 'all';
        data.status = status;
        data.rows = status === 'all' ? rows : rows.filter((r) => r.status === status);
      } else if (tab === 'top') {
        // leaderboard() counts come back as BigInt (Postgres COUNT via $queryRaw);
        // convert so EJS rendering and any length checks stay simple.
        const raw = await asks.leaderboard();
        data.builders = raw.map((b) => ({
          person: b.person,
          shipped: Number(b.shipped),
          raised: Number(b.raised),
        }));
      } else {
        // stalled: open asks older than STALLED_DAYS, with a precomputed age.
        const days = config.behavior.stalledDays;
        const raw = await asks.stalledAsks(days);
        data.days = days;
        data.stalled = raw.map((r) => ({
          ...r,
          ageDays: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000),
        }));
      }

      res.render('index', data);
    } catch (err) {
      next(err);
    }
  });
}

module.exports = { register, requireAuth, passwordMatches };
