// Phase 3 endpoints: audit log viewer, reorder planning, stock ledger
// balances, sales reports (daily + CSV export) and the self-service profile.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  pool, api, resetDb, loginAll, makeProduct, makeCustomer, makeCategory,
} from './helpers.js';

let t;
beforeAll(async () => {
  await resetDb();
  t = await loginAll();
});
afterAll(() => pool.end());

const today = () => new Date().toISOString().slice(0, 10);
const order = (customerId, items) => api(t.ADMIN.token).post('/api/orders').send({ customerId, items });

describe('audit log viewer', () => {
  it('is ADMIN-only', async () => {
    for (const role of ['HR', 'MANAGER', 'EMPLOYEE']) {
      expect((await api(t[role].token).get('/api/audit-logs')).status).toBe(403);
    }
  });

  it('lists entries newest first with the acting user, filterable by action', async () => {
    const res = await api(t.ADMIN.token).get('/api/audit-logs?action=LOGIN');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(4); // loginAll() signed in 4 users
    expect(res.body.rows.every((r) => r.action === 'LOGIN')).toBe(true);
    expect(res.body.rows[0]).toEqual(expect.objectContaining({ user_email: expect.stringMatching(/@test\.com$/) }));
    const ids = res.body.rows.map((r) => r.id);
    expect(ids).toEqual([...ids].sort((a, b) => b - a));
  });

  it('lists the distinct actions for the filter', async () => {
    const res = await api(t.ADMIN.token).get('/api/audit-logs/actions');
    expect(res.body.data).toContain('LOGIN');
  });

  it('validates filters', async () => {
    expect((await api(t.ADMIN.token).get('/api/audit-logs?from=yesterday')).status).toBe(400);
    expect((await api(t.ADMIN.token).get('/api/audit-logs?limit=500')).status).toBe(400);
  });
});

describe('reorder planning', () => {
  let slow; let fast; let empty;
  beforeAll(async () => {
    const categoryId = await makeCategory(t.ADMIN.token);
    slow = await makeProduct(t.ADMIN.token, { categoryId, name: 'Slow', quantity: 20, reorderLevel: 5 });
    fast = await makeProduct(t.ADMIN.token, { categoryId, name: 'Fast', quantity: 10, reorderLevel: 5 });
    empty = await makeProduct(t.ADMIN.token, { categoryId, name: 'Empty', quantity: 0, reorderLevel: 2 });
    const c = await makeCustomer(t.ADMIN.token);
    expect((await order(c, [{ productId: slow, quantity: 6 }, { productId: fast, quantity: 9 }])).status).toBe(201);
  });

  const plan = async (query = '') => {
    const res = await api(t.MANAGER.token).get(`/api/products/insights/reorder${query}`);
    expect(res.status).toBe(200);
    return Object.fromEntries(res.body.data.map((r) => [r.id, r]));
  };

  it('computes velocity, days of stock and a suggested quantity from sales', async () => {
    const rows = await plan();
    // Fast: 9 sold in 30 days -> 0.3/day; 1 left -> 3 days; cover 30 days + reorder level 5 - 1 on hand = 13
    expect(rows[fast]).toEqual(expect.objectContaining({
      quantity: 1, units_sold: 9, daily_velocity: 0.3, days_of_stock: 3, suggested_qty: 13, status: 'REORDER',
    }));
    // Slow: 6 sold -> 0.2/day; 14 left -> 70 days; 6 + 5 - 14 < 0 -> nothing to order
    expect(rows[slow]).toEqual(expect.objectContaining({
      quantity: 14, daily_velocity: 0.2, days_of_stock: 70, suggested_qty: 0, status: 'OK',
    }));
    // No sales: no velocity, but still topped up to the reorder level
    expect(rows[empty]).toEqual(expect.objectContaining({ days_of_stock: null, suggested_qty: 2, status: 'OUT' }));
  });

  it('lists the most urgent products first', async () => {
    const res = await api(t.ADMIN.token).get('/api/products/insights/reorder');
    expect(res.body.data.map((r) => r.status)).toEqual(['OUT', 'REORDER', 'OK']);
  });

  it('honours the cover window and lead time', async () => {
    const rows = await plan('?cover=60&leadTime=90');
    expect(rows[fast].suggested_qty).toBe(22); // 0.3 * 60 + 5 - 1
    expect(rows[slow].status).toBe('REORDER'); // 70 days left < 90-day lead time
  });

  it('is limited to ADMIN/MANAGER and validates its parameters', async () => {
    expect((await api(t.EMPLOYEE.token).get('/api/products/insights/reorder')).status).toBe(403);
    expect((await api(t.ADMIN.token).get('/api/products/insights/reorder?days=1')).status).toBe(400);
  });
});

describe('stock ledger', () => {
  it('pages the ledger with the balance after each movement', async () => {
    const id = await makeProduct(t.ADMIN.token, { quantity: 10 });
    await api(t.ADMIN.token).post(`/api/products/${id}/stock`).send({ type: 'OUT', quantity: 3 });
    await api(t.ADMIN.token).post(`/api/products/${id}/stock`).send({ type: 'IN', quantity: 5 });

    const res = await api(t.EMPLOYEE.token).get(`/api/products/${id}/transactions?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ total: 3, pages: 2, page: 1 }));
    expect(res.body.rows.map((r) => [r.type, r.quantity, Number(r.balance_after)])).toEqual([['IN', 5, 12], ['OUT', 3, 7]]);

    const page2 = await api(t.EMPLOYEE.token).get(`/api/products/${id}/transactions?limit=2&page=2`);
    expect(page2.body.rows.map((r) => Number(r.balance_after))).toEqual([10]);
  });
});

describe('sales reports', () => {
  it('returns revenue per day', async () => {
    const res = await api(t.MANAGER.token).get(`/api/orders/reports/daily?from=${today()}&to=${today()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ day: today(), orders: 1 })]);
  });

  it('exports orders as CSV with spreadsheet formulas neutralised', async () => {
    const product = await makeProduct(t.ADMIN.token, { quantity: 5 });
    const evil = await makeCustomer(t.ADMIN.token, '=HYPERLINK("http://x","click")');
    await order(evil, [{ productId: product, quantity: 2 }]);

    const res = await api(t.ADMIN.token).get(`/api/orders/reports/export?from=${today()}&to=${today()}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toContain(`orders-${today()}-to-${today()}.csv`);
    const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Order #,Date,Status,Customer,Created by,Units,Subtotal,Tax,Discount,Total');
    expect(lines).toHaveLength(3); // header + 2 orders today
    expect(lines[2]).toContain(`"'=HYPERLINK(""http://x"",""click"")"`);
  });

  it('rejects reversed or over-long ranges', async () => {
    const bad = await api(t.ADMIN.token).get('/api/orders/reports/daily?from=2026-05-01&to=2026-04-01');
    expect(bad.status).toBe(400);
    const long = await api(t.ADMIN.token).get('/api/orders/reports/export?from=2024-01-01&to=2026-01-01');
    expect(long.status).toBe(400);
    expect((await api(t.EMPLOYEE.token).get(`/api/orders/reports/export?from=${today()}&to=${today()}`)).status).toBe(403);
  });
});

describe('profile', () => {
  it('returns the linked employee record, including the person\'s own salary', async () => {
    const dept = (await api(t.HR.token).post('/api/departments').send({ name: 'Ops' })).body.data;
    await api(t.ADMIN.token).post('/api/employees').send({ // linking a login is ADMIN-only
      name: 'Employee User', email: 'employee.hr@test.com', departmentId: dept.id,
      designation: 'Analyst', joiningDate: '2025-02-03', salary: 720000, userId: t.EMPLOYEE.id,
    });

    const res = await api(t.EMPLOYEE.token).get('/api/auth/profile');
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('employee@test.com');
    expect(res.body.data.employee).toEqual(expect.objectContaining({
      department: 'Ops', designation: 'Analyst', joining_date: '2025-02-03', salary: '720000.00',
    }));
  });

  it('returns employee: null for a login with no HR record', async () => {
    const res = await api(t.MANAGER.token).get('/api/auth/profile');
    expect(res.body.data.employee).toBeNull();
  });
});
