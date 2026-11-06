import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, pool, resetDb, loginAll, makeCustomer } from './helpers.js';

let t;
beforeAll(async () => { await resetDb(); t = await loginAll(); });
afterAll(() => pool.end());

describe('customers', () => {
  it('searches and paginates', async () => {
    for (const name of ['Alpha Traders', 'Beta Stores', 'Alpine Foods']) await makeCustomer(t.ADMIN.token, name);
    const res = await api(t.MANAGER.token).get('/api/customers?search=Alp&limit=1&page=2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, page: 2, pages: 2 });
    expect(res.body.rows).toHaveLength(1);
  });

  // B6
  it('validates pagination instead of failing with 500', async () => {
    for (const q of ['limit=abc', 'limit=100000', 'page=0']) {
      const res = await api(t.MANAGER.token).get(`/api/customers?${q}`);
      expect(res.status, q).toBe(400);
    }
  });

  it('health check reports the database', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('connected');
  });
});
