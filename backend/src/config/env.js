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

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
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
