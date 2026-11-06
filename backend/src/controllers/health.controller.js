// Health checks, split the way orchestrators use them:
//   live  - the process is up and the event loop answers. Never touches the
//           database: a MySQL outage must not get every API container
//           restarted, which would fix nothing.
//   ready - this instance should receive traffic: MySQL answers within the
//           timeout and the process is not shutting down. Load balancers and
//           `depends_on: service_healthy` use this one.
// GET /api/health is kept as an alias of ready for existing monitors.
const { pool } = require('../config/db');
const lifecycle = require('../utils/lifecycle');

const DB_TIMEOUT_MS = 2000;

function getLive(req, res) {
  res.status(200).json({ success: true, status: 'live', uptimeSeconds: Math.floor(process.uptime()) });
}

// SELECT 1 is the cheapest possible round trip. The timer also covers waiting
// for a free pool connection, so a saturated pool reports not-ready instead of
// hanging the probe.
function pingDatabase() {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('database ping timed out')), DB_TIMEOUT_MS);
  });
  return Promise.race([pool.query('SELECT 1'), timeout]).finally(() => clearTimeout(timer));
}

async function getReady(req, res) {
  if (lifecycle.isShuttingDown()) {
    return res.status(503).json({ success: false, status: 'shutting_down', message: 'Service unavailable' });
  }
  try {
    await pingDatabase();
    res.status(200).json({
      success: true,
      status: 'ready',
      message: 'OK',
      database: 'connected',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    req.log?.warn({ err: err.message }, 'readiness check failed');
    res.status(503).json({ success: false, status: 'unavailable', message: 'Service unavailable', database: 'disconnected' });
  }
}

module.exports = { getLive, getReady };
