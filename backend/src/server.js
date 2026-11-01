// Entry point: verify DB connectivity, start listening, and shut down cleanly.
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { pool, testConnection } = require('./config/db');

async function start() {
  try {
    await testConnection();
    logger.info({ db: `${config.db.host}:${config.db.port}/${config.db.name}` }, 'MySQL connected');
  } catch (err) {
    // Fail fast: an API without its database should not pretend to be healthy
    logger.fatal({ err }, 'failed to connect to MySQL');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, `API listening on http://localhost:${config.port}`);
  });
  server.on('error', (err) => {
    logger.fatal({ err }, 'server failed to start');
    process.exit(1);
  });

  // Graceful shutdown (deploys, docker stop, Ctrl+C): stop accepting new
  // connections, let in-flight requests - and their open transactions - finish,
  // then close the pool. Forced exit if that takes longer than 10s.
  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
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
