// Health check: proves the server is up AND the database is reachable.
// Deploy targets (and interviewers) love this endpoint.
const { pool } = require('../config/db');

async function getHealth(req, res, next) {
  try {
    // SELECT 1 is the cheapest possible query - just proves connectivity
    await pool.query('SELECT 1');
    res.status(200).json({
      success: true,
      message: 'OK',
      database: 'connected',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Server is up but DB is down -> 503 Service Unavailable
    res.status(503).json({
      success: false,
      message: 'Service unavailable',
      database: 'disconnected',
    });
  }
}

module.exports = { getHealth };
