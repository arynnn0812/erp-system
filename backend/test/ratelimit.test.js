// Limits are read when the app module loads, so this file sets small limits
// first and imports the app afterwards (each test file gets fresh modules).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

process.env.LOGIN_RATE_LIMIT_MAX = '3';
process.env.API_RATE_LIMIT_MAX = '12';
const { app, pool, resetDb } = await import('./helpers.js');
const { default: request } = await import('supertest');

beforeAll(resetDb);
afterAll(() => pool.end());

const login = (password) => request(app).post('/api/auth/login').send({ email: 'hr@test.com', password });

describe('rate limiting', () => {
  it('counts only failed logins, then blocks with 429', async () => {
    expect((await login('Password@123')).status).toBe(200); // not counted
    for (let i = 0; i < 3; i += 1) expect((await login('wrong')).status).toBe(401);
    expect((await login('Password@123')).status).toBe(429); // even the right password
  });

  it('applies an API-wide ceiling per client', async () => {
    // 5 requests above already count; 7 more reach the limit of 12.
    for (let i = 0; i < 7; i += 1) {
      expect((await request(app).get('/api/products')).status).toBe(401);
    }
    expect((await request(app).get('/api/products')).status).toBe(429);
    expect((await request(app).get('/api/health')).status).toBe(200); // probes exempt
  });
});
