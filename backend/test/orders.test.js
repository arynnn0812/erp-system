import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  api, pool, resetDb, loginAll, makeCategory, makeProduct, makeCustomer,
} from './helpers.js';

let t;
let customerId;
beforeAll(async () => {
  await resetDb();
  t = await loginAll();
  customerId = await makeCustomer(t.ADMIN.token);
});
afterAll(() => pool.end());

const stockOf = async (id) => {
  const [[row]] = await pool.query('SELECT quantity FROM products WHERE id = ?', [id]);
  return row.quantity;
};
const order = (token, body) => api(token).post('/api/orders').send({ customerId, ...body });

describe('order creation', () => {
  it('prices from the database and computes totals server-side', async () => {
    const id = await makeProduct(t.ADMIN.token, { price: 250, quantity: 10 });
    const res = await order(t.MANAGER.token, {
      items: [{ productId: id, quantity: 2, unitPrice: 1 }], // client price must be ignored
      taxPercent: 18,
      discount: 40,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ subtotal: 500, tax: 90, discount: 40, grandTotal: 550 });
    expect(await stockOf(id)).toBe(8);
  });

  it('rolls back everything when one line has insufficient stock', async () => {
    const a = await makeProduct(t.ADMIN.token, { quantity: 10 });
    const b = await makeProduct(t.ADMIN.token, { quantity: 1 });
    const [[before]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    const res = await order(t.MANAGER.token, { items: [{ productId: a, quantity: 3 }, { productId: b, quantity: 2 }] });
    expect(res.status).toBe(422);
    expect(await stockOf(a)).toBe(10);
    const [[after]] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    expect(after.n).toBe(before.n);
  });

  // B3
  it('merges duplicate lines numerically even when ids and quantities arrive as strings', async () => {
    const id = await makeProduct(t.ADMIN.token, { quantity: 50 });
    const res = await order(t.MANAGER.token, {
      items: [{ productId: String(id), quantity: '3' }, { productId: id, quantity: '2' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.items).toEqual([expect.objectContaining({ productId: id, quantity: 5 })]);
    expect(await stockOf(id)).toBe(45);
  });

  it('is limited to ADMIN and MANAGER', async () => {
    expect((await api(t.EMPLOYEE.token).get('/api/orders')).status).toBe(403);
    expect((await api(t.HR.token).post('/api/orders').send({})).status).toBe(403);
  });
});

describe('order cancellation', () => {
  it('restocks every item once and refuses a second cancel', async () => {
    const id = await makeProduct(t.ADMIN.token, { quantity: 10 });
    const created = await order(t.MANAGER.token, { items: [{ productId: id, quantity: 4 }] });
    const orderId = created.body.data.orderId;
    expect((await api(t.MANAGER.token).post(`/api/orders/${orderId}/cancel`)).status).toBe(200);
    expect(await stockOf(id)).toBe(10);
    expect((await api(t.MANAGER.token).post(`/api/orders/${orderId}/cancel`)).status).toBe(422);
    expect(await stockOf(id)).toBe(10);
  });
});

describe('reporting', () => {
  // B1
  it('returns DATE columns as plain YYYY-MM-DD strings', async () => {
    const id = await makeProduct(t.ADMIN.token);
    const created = await order(t.MANAGER.token, { items: [{ productId: id, quantity: 1 }] });
    const res = await api(t.MANAGER.token).get(`/api/orders/${created.body.data.orderId}`);
    expect(res.body.data.order_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // B2
  it('excludes cancelled orders from category revenue', async () => {
    const categoryId = await makeCategory(t.ADMIN.token, 'Reporting');
    const id = await makeProduct(t.ADMIN.token, { categoryId, price: 100, quantity: 20 });
    await order(t.MANAGER.token, { items: [{ productId: id, quantity: 1 }] });
    const cancelled = await order(t.MANAGER.token, { items: [{ productId: id, quantity: 5 }] });
    await api(t.MANAGER.token).post(`/api/orders/${cancelled.body.data.orderId}/cancel`);

    const res = await api(t.MANAGER.token).get('/api/dashboard/category-sales');
    const row = res.body.data.find((r) => r.category === 'Reporting');
    expect(Number(row.revenue)).toBe(100);
    expect(Number(row.units_sold)).toBe(1);
  });

  // B6
  it('validates dashboard query parameters instead of failing with 500', async () => {
    expect((await api(t.MANAGER.token).get('/api/dashboard/top-products?limit=-1')).status).toBe(400);
    expect((await api(t.MANAGER.token).get('/api/dashboard/sales-trend?months=abc')).status).toBe(400);
  });
});
