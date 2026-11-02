// Process lifecycle state shared by server.js (which flips it on SIGTERM) and
// the readiness check (which then reports 503 so traffic drains away while
// in-flight requests finish).
let shuttingDown = false;

module.exports = {
  isShuttingDown: () => shuttingDown,
  markShuttingDown: () => { shuttingDown = true; },
};
