// Shared test helpers: a clean database per test file and one logged-in
// agent per role.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PASSWORD = 'Password@123';
const ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];

// Wipe business data but keep roles and the migration ledger.
async function resetDb() {
  const keep = new Set(['roles', 'schema_migrations']);
  const [tables] = await pool.query(
    `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()`
  );
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { t } of tables) {
    if (!keep.has(t)) await pool.query(`TRUNCATE TABLE \`${t}\``);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  const hash = await bcrypt.hash(PASSWORD, 4); // low cost: tests, not security
  for (const role of ROLES) {
    await pool.execute(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?))`,
      [`${role} User`, `${role.toLowerCase()}@test.com`, hash, role]
    );
  }
}

// { ADMIN: { token, id }, HR: {...}, ... }
async function loginAll() {
  const out = {};
  for (const role of ROLES) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `${role.toLowerCase()}@test.com`, password: PASSWORD });
    if (res.status !== 200) throw new Error(`login ${role} failed: ${res.status} ${JSON.stringify(res.body)}`);
    out[role] = { token: res.body.data.token, id: res.body.data.user.id };
  }
  return out;
}

// api(token).get('/api/...') with the Authorization header already set.
function api(token) {
  const wrap = (method) => (url) => {
    const r = request(app)[method](url);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  return {
    get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete'),
  };
}

// Small fixtures used across files.
async function makeCategory(token, name = `Cat ${Math.random().toString(36).slice(2, 8)}`) {
  const res = await api(token).post('/api/categories').send({ name });
  return res.body.data.id;
}

async function makeProduct(token, overrides = {}) {
  const categoryId = overrides.categoryId ?? (await makeCategory(token));
  const res = await api(token).post('/api/products').send({
    name: 'Widget',
    sku: `SKU-${Math.random().toString(36).slice(2, 10)}`,
    categoryId,
    price: 100,
    quantity: 10,
    reorderLevel: 2,
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`makeProduct: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

async function makeCustomer(token, name = 'Acme Corp') {
  const res = await api(token).post('/api/customers').send({ name });
  return res.body.data.id;
}

module.exports = {
  app, pool, api, resetDb, loginAll, makeCategory, makeProduct, makeCustomer, PASSWORD,
};
