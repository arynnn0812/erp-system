// Access log + request ID. Every request gets an id (reused from an upstream
// X-Request-Id when it looks sane), echoed back in the response header and
// attached to every log line for that request as req.log, so one failing call
// can be traced end to end.
const crypto = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

const SAFE_ID = /^[A-Za-z0-9._-]{1,100}$/;

module.exports = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customProps: (req) => ({ userId: req.user?.id }),
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: { ignore: (req) => req.url.startsWith('/api/health') }, // probes would drown the log
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
