// Entry point: verify DB connectivity, then start listening.
const app = require('./app');
const config = require('./config/env');
const { testConnection } = require('./config/db');

async function start() {
  try {
    await testConnection();
    console.log(`[db] MySQL connected: ${config.db.host}:${config.db.port}/${config.db.name}`);

    app.listen(config.port, () => {
      console.log(`[server] Running on http://localhost:${config.port} (${config.nodeEnv})`);
    });
  } catch (err) {
    // Fail fast: an API without its database should not pretend to be healthy
    console.error('[startup] Failed to connect to MySQL:', err.message);
    process.exit(1);
  }
}

start();
