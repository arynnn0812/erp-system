const { pool } = require('../config/db');

async function list({ search, page = 1, limit = 10 }) {
  const where = [];
  const params = [];
  if (search) {
    where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM customers ${whereSql}`, params
  );
  const [rows] = await pool.execute(
    `SELECT id, name, email, phone, address, created_at
     FROM customers ${whereSql}
     ORDER BY name
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  return { rows, total, page: Number(page), pages: Math.ceil(total / limit) };
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(c) {
  const [result] = await pool.execute(
    'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
    [c.name, c.email ?? null, c.phone ?? null, c.address ?? null]
  );
  return result.insertId;
}

async function update(id, c) {
  const [result] = await pool.execute(
    'UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
    [c.name, c.email ?? null, c.phone ?? null, c.address ?? null, id]
  );
  return result.affectedRows > 0;
}

module.exports = { list, findById, create, update };
