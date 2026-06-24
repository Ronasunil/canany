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
    res.status(401).render('login', { error: 'Wrong password.' });
  });

  app.post('/logout', (req, res) => {
    req.session = null;
    res.redirect('/login');
  });

  // The board. Same rows the Telegram /board command renders, sorted
  // open -> claimed -> done by asksRepository.listAsks().
  app.get('/', requireAuth, async (req, res, next) => {
    try {
      const rows = await asks.listAsks();
      const counts = STATUS_ORDER.map((s) => ({
        status: s,
        n: rows.filter((r) => r.status === s).length,
      }));
      res.render('board', { rows, counts, total: rows.length });
    } catch (err) {
      next(err);
    }
  });
}

module.exports = { register, requireAuth, passwordMatches };
