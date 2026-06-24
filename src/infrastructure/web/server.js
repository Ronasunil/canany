// The web transport: builds the Express app, wires sessions + EJS, mounts the
// routes, and listens. Analogous to telegram/client.js — index.js calls
// startWeb() once the DB is connected (and only when config.web.enabled).
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const config = require('../../config');
const routes = require('../../application/web/routes');

const VIEWS_DIR = path.join(__dirname, '..', '..', 'presentation', 'web', 'views');

function buildApp() {
  const app = express();

  // Server-side rendered HTML via EJS — no client framework, no build step.
  app.set('view engine', 'ejs');
  app.set('views', VIEWS_DIR);

  // Behind a reverse proxy (the recommended TLS setup) so secure cookies and
  // req.protocol reflect the original https request.
  app.set('trust proxy', 1);

  // Parse the login form post.
  app.use(express.urlencoded({ extended: false }));

  // Stateless signed cookie — just an "authed" flag, so it survives restarts
  // with no server-side store. Secure flag flips on once we're behind HTTPS.
  app.use(cookieSession({
    name: 'canany.sid',
    secret: config.web.sessionSecret,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.web.secureCookie,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  }));

  routes.register(app);

  // Last-resort error handler so a DB hiccup renders a page, not a stack trace.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('Web request failed:', err.message);
    res.status(500).type('text').send('Something went wrong.');
  });

  return app;
}

// Starts listening and resolves once the socket is bound (so index.js can log
// success in order). Rejects if the port is already in use.
function startWeb() {
  const app = buildApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(config.web.port, resolve);
    server.on('error', reject);
  });
}

module.exports = { buildApp, startWeb };
