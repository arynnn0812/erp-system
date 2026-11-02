// Operational behaviour: config validation at startup and the health probes
// that orchestrators (docker compose, a load balancer) rely on.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { createRequire } from 'module';
import { pool, api } from './helpers.js';

// require(), not import: the app loads these with require, and the test must
// share that module instance to flip the shutdown flag the app reads.
const require = createRequire(import.meta.url);
const { buildConfig } = require('../src/config/buildConfig');
const lifecycle = require('../src/utils/lifecycle');

afterAll(() => pool.end());

const BASE = { DB_HOST: 'db', DB_USER: 'erp', DB_NAME: 'erp', JWT_SECRET: 'dev-secret' };
const PROD = { ...BASE, NODE_ENV: 'production', DB_PASSWORD: 'pw', JWT_SECRET: 'x'.repeat(40) };

// The thrown error lists every problem; return them for assertions.
function problems(env) {
  try {
    buildConfig(env);
    return [];
  } catch (err) {
    return err.problems;
  }
}

describe('config validation', () => {
  it('accepts a minimal development environment and applies defaults', () => {
    const c = buildConfig(BASE);
    expect(c).toMatchObject({ port: 4000, nodeEnv: 'development', cookieSecure: false, logLevel: 'info', trustProxy: 0 });
    expect(c.db.port).toBe(3306);
    expect(c.jwt.expiresIn).toBe('1d');
    expect(c.warnings).toEqual([]);
  });

  it('reports every problem at once, not just the first', () => {
    const p = problems({ PORT: '40000x', NODE_ENV: 'prod', LOG_LEVEL: 'loud', CLIENT_URL: 'erp.example.com', JWT_EXPIRES_IN: 'soon' });
    expect(p).toEqual(expect.arrayContaining([
      'DB_HOST is required', 'DB_USER is required', 'DB_NAME is required', 'JWT_SECRET is required',
      expect.stringMatching(/^NODE_ENV must be one of/),
      expect.stringMatching(/^PORT must be a whole number/),
      expect.stringMatching(/^LOG_LEVEL must be one of/),
      expect.stringMatching(/^CLIENT_URL must be an http\(s\) URL/),
      expect.stringMatching(/^JWT_EXPIRES_IN is not a valid duration/),
    ]));
    expect(p).toHaveLength(9);
  });

  it('accepts the durations jsonwebtoken accepts', () => {
    for (const d of ['1d', '12h', '30m', '7 days', '3600']) expect(problems({ ...BASE, JWT_EXPIRES_IN: d }), d).toEqual([]);
  });

  it('holds production to stricter rules', () => {
    expect(problems(PROD)).toEqual([]);
    expect(buildConfig(PROD).cookieSecure).toBe(true);
    expect(problems({ ...PROD, JWT_SECRET: 'short' })).toEqual(['JWT_SECRET must be at least 32 characters in production']);
    expect(problems({ ...PROD, JWT_SECRET: 'replace_with_a_long_random_string' }))
      .toEqual(['JWT_SECRET is still the example value from .env.example']);
    expect(problems({ ...PROD, DB_PASSWORD: '' })).toEqual(['DB_PASSWORD must be set in production']);
  });

  it('lets COOKIE_SECURE override the default, with a warning in production', () => {
    expect(buildConfig({ ...BASE, COOKIE_SECURE: 'true' }).cookieSecure).toBe(true);
    const c = buildConfig({ ...PROD, COOKIE_SECURE: 'false' });
    expect(c.cookieSecure).toBe(false);
    expect(c.warnings).toEqual([expect.stringMatching(/^COOKIE_SECURE=false in production/)]);
    expect(problems({ ...BASE, COOKIE_SECURE: 'yes' })).toEqual(['COOKIE_SECURE must be true or false (got "yes")']);
  });

  it('flags half-configured AWS settings', () => {
    expect(buildConfig({ ...BASE, AWS_REGION: 'ap-south-1' }).warnings)
      .toEqual([expect.stringMatching(/^Only one of AWS_REGION and S3_BUCKET_NAME/)]);
    expect(problems({ ...BASE, AWS_ACCESS_KEY_ID: 'AKIA' }))
      .toEqual([expect.stringMatching(/^AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set together/)]);
  });

  it('reads secrets from *_FILE paths', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-secrets-'));
    const file = path.join(dir, 'jwt');
    fs.writeFileSync(file, `${'s'.repeat(40)}\n`); // trailing newline, as `echo >` writes it
    try {
      const rest = { ...PROD };
      delete rest.JWT_SECRET;
      expect(buildConfig({ ...rest, JWT_SECRET_FILE: file }).jwt.secret).toBe('s'.repeat(40));
      expect(problems({ ...PROD, JWT_SECRET_FILE: file })).toEqual(['JWT_SECRET and JWT_SECRET_FILE are both set; use one']);
      expect(problems({ ...rest, JWT_SECRET_FILE: path.join(dir, 'missing') })).toEqual([
        expect.stringMatching(/^JWT_SECRET_FILE: cannot read .*missing \(ENOENT\)$/),
        'JWT_SECRET is required',
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});

describe('health probes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('liveness answers without touching the database', async () => {
    const spy = vi.spyOn(pool, 'query');
    const res = await api().get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('live');
    expect(spy).not.toHaveBeenCalled();
  });

  it('readiness checks the database; /api/health is an alias', async () => {
    for (const url of ['/api/health/ready', '/api/health']) {
      const res = await api().get(url);
      expect(res.status, url).toBe(200);
      expect(res.body).toMatchObject({ status: 'ready', database: 'connected' });
    }
  });

  it('readiness fails when the database errors', async () => {
    vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await api().get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'unavailable', database: 'disconnected' });
  });

  it('readiness fails, instead of hanging, when the database does not answer', async () => {
    vi.spyOn(pool, 'query').mockReturnValueOnce(new Promise(() => {}));
    const started = Date.now();
    const res = await api().get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  // Last: there is no way back from shutting down (module state is per file).
  it('readiness reports 503 once shutdown starts, liveness stays up', async () => {
    lifecycle.markShuttingDown();
    expect((await api().get('/api/health/ready')).status).toBe(503);
    expect((await api().get('/api/health/ready')).body.status).toBe('shutting_down');
    expect((await api().get('/api/health/live')).status).toBe(200);
  });
});
