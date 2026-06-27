// Web routes. Mounted by src/infrastructure/web/server.js.
// The web is the product front door: signup -> create org -> connect token, then
// a per-org board mirroring what the Telegram bot shows for that org. Accounts are
// real (bcryptjs); the session cookie carries { uid, orgId, csrf }.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../../config');
const asks = require('../../infrastructure/db/asksRepository');
const users = require('../../infrastructure/db/usersRepository');
const orgs = require('../../infrastructure/db/orgsRepository');
const { STATUS_ORDER } = require('../../domain/constants');

const BCRYPT_COST = 10;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

// ---- CSRF (synchronizer token) ----
// sameSite:'lax' on the cookie is the baseline; authed POSTs additionally carry a
// per-session token compared timing-safely. Minted lazily in requireAuth.
function ensureCsrf(req) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(16).toString('hex');
  return req.session.csrf;
}

function verifyCsrf(req, res, next) {
  const sent = Buffer.from(String((req.body && req.body._csrf) || ''));
  const want = Buffer.from(String((req.session && req.session.csrf) || ''));
  if (sent.length > 0 && sent.length === want.length && crypto.timingSafeEqual(sent, want)) return next();
  return res.status(403).type('text').send('Bad CSRF token. Reload the page and try again.');
}

// Gate for everything that shows data. Loads the user fresh each request so a
// deleted account can't keep a live session. Bounces to /login otherwise.
async function requireAuth(req, res, next) {
  try {
    if (!req.session || !req.session.uid) return res.redirect('/login');
    const user = await users.findUserById(req.session.uid);
    if (!user) { req.session = null; return res.redirect('/login'); } // account gone -> hard logout
    req.user = user;
    res.locals.user = user;
    res.locals.csrf = ensureCsrf(req);
    next();
  } catch (err) { next(err); }
}

// The org the request acts on. Returns the owned-org list and the "current" org
// (session.orgId if still owned, else the first org), persisting the choice so
// board links need no ?org param. current is null when the user owns no org yet.
async function resolveCurrentOrg(req) {
  const list = await orgs.listOrgsByUser(req.user.id);
  if (!list.length) return { list, current: null };
  const current = list.find((o) => o.id === req.session.orgId) || list[0];
  req.session.orgId = current.id;
  return { list, current };
}

// Styled 404 — also used for "not your org" so we never leak whether an org id
// exists (no existence leak: same response for missing and not-owned).
function notFound(res, message) {
  return res.status(404).render('404', { title: 'canany — not found', message: message || 'Not found.' });
}

// Load an org the current user owns, or send a 404 and return null. Callers must
// `if (!org) return;` immediately.
async function loadOwnedOrg(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { notFound(res, 'No such org.'); return null; }
  const org = await orgs.getOrg(id);
  if (!org || org.owner_user_id !== req.user.id) { notFound(res, 'No such org.'); return null; }
  return org;
}

function register(app) {
  // Liveness probe — no auth, so an uptime checker can hit it without a session.
  app.get('/healthz', (_req, res) => res.type('text').send('ok'));

  // ---- Signup ----
  app.get('/signup', (req, res) => {
    if (req.session && req.session.uid) return res.redirect('/');
    res.render('signup', { error: null, email: '', codeRequired: Boolean(config.web.signupCode) });
  });

  app.post('/signup', async (req, res, next) => {
    try {
      const codeRequired = Boolean(config.web.signupCode);
      const render = (error, status = 400) =>
        res.status(status).render('signup', { error, email: req.body.email || '', codeRequired });

      if (codeRequired && String(req.body._code || '') !== config.web.signupCode) {
        return render('That signup code isn’t valid.');
      }
      const email = normalizeEmail(req.body.email);
      const password = String(req.body.password || '');
      if (!EMAIL_RE.test(email)) return render('Enter a valid email address.');
      if (password.length < 8) return render('Password must be at least 8 characters.');

      if (await users.findUserByEmail(email)) return render('That email is already registered. Log in instead.', 409);

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      let user;
      try {
        user = await users.createUser({ email, passwordHash });
      } catch (e) {
        // Lost the race to the unique-email constraint — treat as a dup.
        if (e && e.code === 'P2002') return render('That email is already registered. Log in instead.', 409);
        throw e;
      }

      // Reset the session before setting uid — avoids fixation / attacker-seeded orgId.
      req.session = null;
      req.session = { uid: user.id };
      return res.redirect('/');
    } catch (err) { next(err); }
  });

  // ---- Login ----
  app.get('/login', (req, res) => {
    if (req.session && req.session.uid) return res.redirect('/');
    res.render('login', { error: null, email: '' });
  });

  app.post('/login', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      const password = String(req.body.password || '');
      // Generic message either way — never reveal whether the email exists.
      const fail = () => res.status(401).render('login', { error: 'Wrong email or password.', email: req.body.email || '' });

      const user = await users.findUserByEmail(email);
      if (!user) return fail();
      if (!(await bcrypt.compare(password, user.password_hash))) return fail();

      req.session = null;
      req.session = { uid: user.id };
      return res.redirect('/');
    } catch (err) { next(err); }
  });

  app.post('/logout', requireAuth, verifyCsrf, (req, res) => {
    req.session = null;
    res.redirect('/login');
  });

  // ---- The per-org board ----
  const TABS = ['board', 'top', 'stalled'];
  const STATUS_FILTERS = [...STATUS_ORDER, 'all'];

  app.get('/', requireAuth, async (req, res, next) => {
    try {
      const { list, current } = await resolveCurrentOrg(req);
      if (!current) return res.redirect('/orgs/new'); // 0 orgs -> create one first

      // ?org=<id> switches the active org (only if owned), then PRG-redirects so
      // the param doesn't linger in the URL.
      if (req.query.org !== undefined) {
        const owned = list.find((o) => o.id === Number(req.query.org));
        if (!owned) return notFound(res, 'No such org.');
        req.session.orgId = owned.id;
        return res.redirect('/');
      }

      // Anything unrecognised falls back to the default, so a hand-edited query
      // string can never 500 the page. Queries are scoped to the current org.
      const tab = TABS.includes(req.query.tab) ? req.query.tab : 'board';
      const data = { tab, org: current, orgs: list };

      if (tab === 'board') {
        const rows = await asks.listAsks(current.id);
        // Counts over the FULL set so the chips always show real totals.
        data.counts = STATUS_ORDER.map((s) => ({ status: s, n: rows.filter((r) => r.status === s).length }));
        data.total = rows.length;
        const status = STATUS_FILTERS.includes(req.query.status) ? req.query.status : 'all';
        data.status = status;
        data.rows = status === 'all' ? rows : rows.filter((r) => r.status === status);
      } else if (tab === 'top') {
        // COUNT comes back BigInt via $queryRaw — convert for EJS.
        const raw = await asks.leaderboard(current.id);
        data.builders = raw.map((b) => ({ person: b.person, shipped: Number(b.shipped), raised: Number(b.raised) }));
      } else {
        const days = config.behavior.stalledDays;
        const raw = await asks.stalledAsks(current.id, days);
        data.days = days;
        data.stalled = raw.map((r) => ({
          ...r,
          ageDays: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000),
        }));
      }

      res.render('index', data);
    } catch (err) { next(err); }
  });

  // ---- Orgs ----
  // /orgs/new is defined BEFORE /orgs/:id so the literal path wins.
  app.get('/orgs/new', requireAuth, (req, res) => {
    res.render('org-new', { error: null, name: '' });
  });

  app.post('/orgs', requireAuth, verifyCsrf, async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim();
      if (name.length < 1 || name.length > 80) {
        return res.status(400).render('org-new', { error: 'Org name must be 1–80 characters.', name: req.body.name || '' });
      }
      const org = await orgs.createOrg({ name, ownerUserId: req.user.id });
      await orgs.createConnectToken(org.id);
      req.session.orgId = org.id;
      return res.redirect(`/orgs/${org.id}`);
    } catch (err) { next(err); }
  });

  app.get('/orgs/:id', requireAuth, async (req, res, next) => {
    try {
      const org = await loadOwnedOrg(req, res);
      if (!org) return;
      const token = await orgs.getActiveConnectToken(org.id);
      const connectedGroups = await orgs.listGroupsByOrg(org.id);
      const botLink = config.telegram.botUsername
        ? `https://t.me/${config.telegram.botUsername}?startgroup=true`
        : null;
      res.render('org', { org, token, connectedGroups, botLink });
    } catch (err) { next(err); }
  });

  app.post('/orgs/:id/token', requireAuth, verifyCsrf, async (req, res, next) => {
    try {
      const org = await loadOwnedOrg(req, res);
      if (!org) return;
      await orgs.regenerateConnectToken(org.id);
      return res.redirect(`/orgs/${org.id}`);
    } catch (err) { next(err); }
  });
}

module.exports = { register, requireAuth };
