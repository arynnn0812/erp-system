// Session cookie helpers. No cookie-parser dependency: reading one cookie is
// a few lines, and setting it uses Express's built-in res.cookie().
const config = require('../config/env');

const SESSION_COOKIE = 'erp_session';

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

// httpOnly: page JavaScript (and therefore XSS) cannot read the token.
// sameSite strict: the browser never attaches it to a request started by
// another site, which is the CSRF defence. secure: HTTPS-only in production.
function cookieOptions(expiresAt) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure, // on in production unless COOKIE_SECURE=false
    path: '/api',
    ...(expiresAt && { expires: expiresAt }),
  };
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

module.exports = { SESSION_COOKIE, readCookie, setSessionCookie, clearSessionCookie };
