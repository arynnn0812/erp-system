// One structured (JSON) logger for the whole process. JSON lines are what log
// pipelines (CloudWatch, Loki, Datadog) index; pipe through `npx pino-pretty`
// locally for readable output.
const pino = require('pino');
const config = require('../config/env');

const logger = pino({
  level: config.logLevel,
  base: { service: 'erp-api' },
  // Credentials must never reach log storage.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password', '*.currentPassword', '*.newPassword',
    ],
    censor: '[redacted]',
  },
});

module.exports = logger;
