// Loads .env once and exports typed config values.
// Every other file imports from here instead of reading process.env directly,
// so all environment access is in one place and missing values fail fast.
require('dotenv').config();

const required = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

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

const nodeEnv = process.env.NODE_ENV || 'development';

// A short secret makes HS256 tokens brute-forceable offline. Refuse to start
// in production with one (generate: openssl rand -base64 48).
if (nodeEnv === 'production' && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

const int = (raw, fallback) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
};

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  logLevel: process.env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
  rateLimit: {
    apiMax: int(process.env.API_RATE_LIMIT_MAX, 300),   // requests / minute / IP
    loginMax: int(process.env.LOGIN_RATE_LIMIT_MAX, 10), // failed logins / 15 min / IP
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET_NAME,
  },
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
};
