// MySQL connection POOL (not a single connection).
// A pool keeps ~10 connections open and reuses them, so we don't pay the
// cost of opening a TCP connection per request, and parallel requests
// don't queue behind one connection.
const mysql = require('mysql2/promise');
const config = require('./env');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  waitForConnections: true, // if all 10 busy, queue the request instead of erroring
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  // DATE columns come back as 'YYYY-MM-DD' strings. Left as JS Dates, mysql2
  // builds local midnight, JSON serialises it as UTC, and any server east of
  // Greenwich (IST: '2026-01-15' -> '2026-01-14T18:30:00Z') shows the previous
  // day - and the edit form would write that wrong date back.
  dateStrings: ['DATE'],
});

// Called once at startup so the server fails immediately (not on first
// request) if the database is unreachable.
async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release(); // return connection to the pool - never forget this
}

module.exports = { pool, testConnection };
