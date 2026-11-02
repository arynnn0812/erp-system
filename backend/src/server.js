// Entry point: verify DB connectivity, start listening, and shut down cleanly.
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const lifecycle = require('./utils/lifecycle');
const { pool, testConnection } = require('./config/db');
const { version } = require('../package.json');

// MySQL often finishes starting a few seconds after the API (container
// restarts, a VM booting both). Retry for ~20s before giving up, so a normal
// race is not a crash loop but a database that is really gone still fails.
const DB_CONNECT_ATTEMPTS = 10;
const DB_CONNECT_DELAY_MS = 2000;

async function connectWithRetry() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await testConnection();
      return;
    } catch (err) {
      if (attempt === DB_CONNECT_ATTEMPTS) throw err;
      logger.warn({ attempt, of: DB_CONNECT_ATTEMPTS, reason: err.code || err.message }, 'MySQL not reachable yet, retrying');
      await new Promise((resolve) => setTimeout(resolve, DB_CONNECT_DELAY_MS));
    }
  }
}

async function start() {
  for (const warning of config.warnings) logger.warn(warning);

  try {
    await connectWithRetry();
    logger.info({ db: `${config.db.host}:${config.db.port}/${config.db.name}` }, 'MySQL connected');
  } catch (err) {
    // Fail fast: an API without its database should not pretend to be healthy
    logger.fatal({ err }, 'failed to connect to MySQL');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv, version }, `API listening on http://localhost:${config.port}`);
  });
  server.on('error', (err) => {
    logger.fatal({ err }, 'server failed to start');
    process.exit(1);
  });

  // Graceful shutdown (deploys, docker stop, Ctrl+C): report not-ready, stop
  // accepting new connections, let in-flight requests - and their open
  // transactions - finish, then close the pool. Forced exit after 10s.
  const shutdown = (signal) => {
    if (lifecycle.isShuttingDown()) return;
    lifecycle.markShuttingDown();
    logger.info({ signal }, 'shutting down');
    setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000).unref();
    server.close(async () => {
      await pool.end();
      logger.info('shutdown complete');
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'unhandled promise rejection');
  process.exit(1); // state is unknown; let the process manager restart us
});

start();
