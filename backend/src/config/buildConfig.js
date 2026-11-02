// Turns an environment (process.env, or a plain object in tests) into the
// typed config the app uses. Every problem is collected and reported at once,
// so a bad deploy fails at startup with one readable list instead of one
// error per restart - or, worse, on the first request that touches the value.
const fs = require('fs');
const jwt = require('jsonwebtoken');

const NODE_ENVS = ['development', 'test', 'production'];
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const EXAMPLE_SECRET = 'replace_with_a_long_random_string'; // the value in .env.example

// Secrets may be given as NAME_FILE=/path instead of NAME=value (Docker and
// Kubernetes secrets are mounted as files), which keeps them out of the
// process environment and `docker inspect`.
const SECRET_KEYS = ['DB_PASSWORD', 'JWT_SECRET', 'AWS_SECRET_ACCESS_KEY'];

// How many reverse proxies sit in front of this app.
// 0 (default) = none: req.ip is the socket address, X-Forwarded-For ignored.
// 1 = one proxy (nginx/ALB): req.ip is the real client IP.
// Getting this wrong is not cosmetic - with 0 behind nginx every request looks
// like it came from the proxy, so the login rate limiter buckets ALL users
// together and audit_logs records the proxy IP. With a too-permissive value on
// a directly-exposed server, clients can spoof X-Forwarded-For and dodge the
// limiter. Set it to the actual number of proxies you run.
function parseTrustProxy(raw) {
  if (raw === undefined || raw === '') return 0;
  if (raw === 'true') return 1;
  if (raw === 'false') return 0;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n; // allow 'loopback' or an IP/CIDR list
}

function buildConfig(source) {
  const errors = [];
  const warnings = [];
  const env = { ...source };

  for (const key of SECRET_KEYS) {
    const file = env[`${key}_FILE`];
    if (!file) continue;
    if (env[key]) {
      errors.push(`${key} and ${key}_FILE are both set; use one`);
      continue;
    }
    try {
      env[key] = fs.readFileSync(file, 'utf8').trim();
    } catch (err) {
      errors.push(`${key}_FILE: cannot read ${file} (${err.code || err.message})`);
    }
  }

  for (const key of ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET']) {
    if (!env[key]) errors.push(`${key} is required`);
  }

  const nodeEnv = env.NODE_ENV || 'development';
  if (!NODE_ENVS.includes(nodeEnv)) errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')} (got "${nodeEnv}")`);
  const production = nodeEnv === 'production';

  // Integers: unset means the default; set but malformed is an error rather
  // than a silent fallback (PORT=40000x should not quietly become 4000).
  const int = (key, fallback, min, max) => {
    const raw = env[key];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      errors.push(`${key} must be a whole number from ${min} to ${max} (got "${raw}")`);
      return fallback;
    }
    return n;
  };

  const logLevel = env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info');
  if (!LOG_LEVELS.includes(logLevel)) errors.push(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')} (got "${logLevel}")`);

  const clientUrl = env.CLIENT_URL || 'http://localhost:5173';
  try {
    if (!/^https?:$/.test(new URL(clientUrl).protocol)) throw new Error();
  } catch {
    errors.push(`CLIENT_URL must be an http(s) URL such as https://erp.example.com (got "${clientUrl}")`);
  }

  // Let jsonwebtoken itself judge the value: it accepts '1d', '12h', '7 days',
  // or seconds, and would otherwise only throw on the first login.
  const expiresIn = env.JWT_EXPIRES_IN || '1d';
  try {
    jwt.sign({}, 'probe', { expiresIn: /^\d+$/.test(expiresIn) ? Number(expiresIn) : expiresIn });
  } catch {
    errors.push(`JWT_EXPIRES_IN is not a valid duration such as 1d, 12h or 3600 (got "${expiresIn}")`);
  }

  // Secure cookies are only sent over HTTPS, so production defaults to them.
  // COOKIE_SECURE=false exists for trying a production build over plain http
  // on a LAN address; browsers drop Secure cookies there and login would loop.
  let cookieSecure = production;
  if (env.COOKIE_SECURE !== undefined && env.COOKIE_SECURE !== '') {
    if (!['true', 'false'].includes(env.COOKIE_SECURE)) errors.push(`COOKIE_SECURE must be true or false (got "${env.COOKIE_SECURE}")`);
    cookieSecure = env.COOKIE_SECURE === 'true';
  }

  if (production) {
    // A short secret makes HS256 tokens brute-forceable offline.
    // Generate one with: openssl rand -base64 48
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) errors.push('JWT_SECRET must be at least 32 characters in production');
    if (env.JWT_SECRET === EXAMPLE_SECRET) errors.push('JWT_SECRET is still the example value from .env.example');
    if (!env.DB_PASSWORD) errors.push('DB_PASSWORD must be set in production');
    if (!cookieSecure) warnings.push('COOKIE_SECURE=false in production: the session cookie will also be sent over plain http');
  }

  if (Boolean(env.AWS_REGION) !== Boolean(env.S3_BUCKET_NAME)) {
    warnings.push('Only one of AWS_REGION and S3_BUCKET_NAME is set; document storage stays disabled until both are');
  }
  if (Boolean(env.AWS_ACCESS_KEY_ID) !== Boolean(env.AWS_SECRET_ACCESS_KEY)) {
    errors.push('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together (or neither, to use an IAM role)');
  }

  const config = {
    port: int('PORT', 4000, 1, 65535),
    nodeEnv,
    clientUrl,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    logLevel,
    cookieSecure,
    rateLimit: {
      apiMax: int('API_RATE_LIMIT_MAX', 300, 1, 100000),  // requests / minute / IP
      loginMax: int('LOGIN_RATE_LIMIT_MAX', 10, 1, 10000), // failed logins / 15 min / IP
    },
    jwt: {
      secret: env.JWT_SECRET,
      expiresIn,
    },
    aws: {
      region: env.AWS_REGION,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      bucket: env.S3_BUCKET_NAME,
    },
    db: {
      host: env.DB_HOST,
      port: int('DB_PORT', 3306, 1, 65535),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      name: env.DB_NAME,
    },
    warnings,
  };

  if (errors.length) {
    const err = new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
    err.problems = errors;
    throw err;
  }
  return config;
}

module.exports = { buildConfig };
