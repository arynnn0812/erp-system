// GET /api/dashboard/stream - Server-Sent Events for the live dashboard.
//
// The browser opens it with EventSource (the session cookie rides along) and
// receives:
//   event: ready    once, when the stream is open
//   event: change   data: {"topic":"dashboard"} after a write; refetch
//   : ping          a comment every 25s, so proxies keep the connection
//
// A stream outlives the request that authenticated it, so the session is
// checked again on every heartbeat and before every forwarded change: logout
// everywhere, deactivation, a role change or token expiry ends the stream,
// and EventSource's reconnect then gets a 401 and stops.
const userModel = require('../models/user.model');
const events = require('../utils/events');
const ApiError = require('../utils/ApiError');

const HEARTBEAT_MS = 25_000; // under nginx's 60s proxy_read_timeout
const RETRY_MS = 5_000;      // EventSource reconnect delay after a drop
const MAX_STREAMS_PER_USER = 5;

const openPerUser = new Map(); // userId -> number of open streams

async function sessionStillValid(req) {
  if (Date.now() >= req.auth.exp * 1000) return false;
  const u = await userModel.findAuthState(req.user.id);
  return !!u && !!u.is_active && u.token_version === req.auth.tv && u.role === req.user.role;
}

function stream(req, res, next) {
  const userId = req.user.id;
  const open = openPerUser.get(userId) || 0;
  if (open >= MAX_STREAMS_PER_USER) {
    return next(new ApiError(429, 'Too many open live connections; close a tab and try again'));
  }
  openPerUser.set(userId, open + 1);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // tells nginx not to buffer this response
  });
  res.write(`retry: ${RETRY_MS}\nevent: ready\ndata: {}\n\n`);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    unsubscribeClose();
    const n = (openPerUser.get(userId) || 1) - 1;
    if (n > 0) openPerUser.set(userId, n); else openPerUser.delete(userId);
    res.end();
  };

  // Ends the stream (instead of writing) once the session is no longer valid.
  const writeIfValid = (chunk) => sessionStillValid(req)
    .then((ok) => { if (closed) return; if (ok) res.write(chunk); else close(); })
    .catch((err) => { req.log.warn({ err }, 'live stream session check failed'); close(); });

  const heartbeat = setInterval(() => writeIfValid(': ping\n\n'), HEARTBEAT_MS);
  const unsubscribe = events.onChange((topic) => writeIfValid(`event: change\ndata: ${JSON.stringify({ topic })}\n\n`));
  const unsubscribeClose = events.onCloseAll(close);
  req.on('close', close);
}

module.exports = { stream, MAX_STREAMS_PER_USER };
