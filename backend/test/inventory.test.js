import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, pool, resetDb, loginAll, makeCategory, makeProduct } from './helpers.js';

let t;
beforeAll(async () => { await resetDb(); t = await loginAll(); });
afterAll(() => pool.end());

const stockOf = async (id) => {
  const [[row]] = await pool.query('SELECT quantity FROM products WHERE id = ?', [id]);
  return row.quantity;
};

describe('products', () => {
  it('records opening stock as an IN transaction', async () => {
    const id = await makeProduct(t.ADMIN.token, { quantity: 7 });
    const res = await api(t.EMPLOYEE.token).get(`/api/products/${id}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ type: 'IN', quantity: 7, reference: 'OPENING_STOCK' })]);
  });

  it('rejects a duplicate SKU with 409', async () => {
    const categoryId = await makeCategory(t.ADMIN.token);
    await makeProduct(t.ADMIN.token, { sku: 'DUP-1', categoryId });
    const res = await api(t.ADMIN.token).post('/api/products')
      .send({ name: 'Again', sku: 'DUP-1', categoryId, price: 1 });
    expect(res.status).toBe(409);
  });

  it('lets EMPLOYEE read but not write', async () => {
    expect((await api(t.EMPLOYEE.token).get('/api/products')).status).toBe(200);
    const categoryId = await makeCategory(t.ADMIN.token);
    const res = await api(t.EMPLOYEE.token).post('/api/products').send({ name: 'x', sku: 'E-1', categoryId, price: 1 });
    expect(res.status).toBe(403);
  });

  // B5
  it('updates a product when the optional reorderLevel is omitted', async () => {
    const id = await makeProduct(t.ADMIN.token, { reorderLevel: 4 });
    const [[p]] = await pool.query('SELECT category_id FROM products WHERE id = ?', [id]);
    const res = await api(t.MANAGER.token).put(`/api/products/${id}`)
      .send({ name: 'Renamed', sku: 'ignored', categoryId: p.category_id, price: 120 });
    expect(res.status).toBe(200);
    const [[after]] = await pool.query('SELECT name, price, reorder_level FROM products WHERE id = ?', [id]);
    expect(after).toMatchObject({ name: 'Renamed', price: '120.00', reorder_level: 4 });
  });

  // B9
  it('does not leave a product without its opening-stock ledger row', async () => {
    // A token whose user row is gone: the products insert succeeds, the ledger
    // insert hits the performed_by foreign key. Creation must be all-or-nothing.
    const categoryId = await makeCategory(t.ADMIN.token);
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role_id)
       VALUES (999, 'Ghost', 'ghost@test.com', 'x', (SELECT id FROM roles WHERE name = 'ADMIN'))`
    );
    const jwt = await import('jsonwebtoken');
    const ghost = jwt.default.sign({ id: 999, role: 'ADMIN' }, process.env.JWT_SECRET);
    await pool.query('DELETE FROM users WHERE id = 999');

    const res = await api(ghost).post('/api/products')
      .send({ name: 'Orphan', sku: 'ORPHAN-1', categoryId, price: 1, quantity: 5 });
    expect(res.status).not.toBe(201);
    const [rows] = await pool.query("SELECT id FROM products WHERE sku = 'ORPHAN-1'");
    expect(rows).toHaveLength(0);
  });
});

describe('stock movements', () => {
  it('refuses to take stock below zero (422) and leaves quantity unchanged', async () => {
    const id = await makeProduct(t.ADMIN.token, { quantity: 3 });
    const res = await api(t.MANAGER.token).post(`/api/products/${id}/stock`).send({ type: 'OUT', quantity: 4 });
    expect(res.status).toBe(422);
    expect(await stockOf(id)).toBe(3);
  });

  it('serialises concurrent stock-outs: no oversell, no lost update', async () => {
    const id = await makeProduct(t.ADMIN.token, { quantity: 5 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        api(t.MANAGER.token).post(`/api/products/${id}/stock`).send({ type: 'OUT', quantity: 1 }))
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(5);
    expect(codes.filter((c) => c === 422)).toHaveLength(5);
    expect(await stockOf(id)).toBe(0);
  });
});

describe('categories', () => {
  it('refuses to delete a category that still has products (409)', async () => {
    const categoryId = await makeCategory(t.ADMIN.token);
    await makeProduct(t.ADMIN.token, { categoryId });
    expect((await api(t.ADMIN.token).delete(`/api/categories/${categoryId}`)).status).toBe(409);
  });

  // B4
  it('rejects renaming a category to an existing name with 409', async () => {
    await makeCategory(t.ADMIN.token, 'Taken');
    const id = await makeCategory(t.ADMIN.token, 'Free');
    const res = await api(t.ADMIN.token).put(`/api/categories/${id}`).send({ name: 'Taken' });
    expect(res.status).toBe(409);
  });
});
