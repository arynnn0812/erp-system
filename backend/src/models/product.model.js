// Products SQL. The list() query shows the classic search+filter+pagination
// pattern; the WHERE clause is built dynamically but values stay parameterized.
const { pool } = require('../config/db');

async function list({ search, categoryId, lowStock, page = 1, limit = 10 }) {
  const where = ['p.is_active = TRUE'];
  const params = [];

  if (search) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    where.push('p.category_id = ?');
    params.push(categoryId);
  }
  if (lowStock) {
    where.push('p.quantity < p.reorder_level');
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;

  // Two queries: total count (for the frontend's page buttons) + one page of rows.
  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
    params
  );

  // LIMIT/OFFSET are validated integers interpolated directly - mysql2's
  // execute() cannot bind LIMIT placeholders in all MySQL versions.
  const [rows] = await pool.execute(
    `SELECT p.id, p.name, p.sku, p.price, p.quantity, p.reorder_level,
            p.supplier, c.id AS category_id, c.name AS category,
            (p.quantity < p.reorder_level) AS low_stock
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.name
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );

  return { rows, total, page: Number(page), pages: Math.ceil(total / limit) };
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT p.*, c.name AS category
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.id = ? AND p.is_active = TRUE`,
    [id]
  );
  return rows[0] || null;
}

async function findBySku(sku) {
  const [rows] = await pool.execute('SELECT * FROM products WHERE sku = ?', [sku]);
  return rows[0] || null;
}

async function create(p) {
  const [result] = await pool.execute(
    `INSERT INTO products (name, sku, category_id, price, quantity, reorder_level, supplier)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.sku, p.categoryId, p.price, p.quantity ?? 0, p.reorderLevel ?? 10, p.supplier ?? null]
  );
  return result.insertId;
}

async function update(id, p) {
  const [result] = await pool.execute(
    `UPDATE products
     SET name = ?, category_id = ?, price = ?, reorder_level = ?, supplier = ?
     WHERE id = ? AND is_active = TRUE`,
    [p.name, p.categoryId, p.price, p.reorderLevel, p.supplier ?? null, id]
  );
  return result.affectedRows > 0;
}

// Soft delete: old orders reference this product, so a hard DELETE would
// either fail (FK) or orphan history. is_active=FALSE hides it from lists.
async function softDelete(id) {
  const [result] = await pool.execute(
    'UPDATE products SET is_active = FALSE WHERE id = ? AND is_active = TRUE',
    [id]
  );
  return result.affectedRows > 0;
}

async function listTransactions(productId, { page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.execute(
    `SELECT t.id, t.type, t.quantity, t.reference, t.created_at,
            u.name AS performed_by
     FROM inventory_transactions t
     JOIN users u ON u.id = t.performed_by
     WHERE t.product_id = ?
     ORDER BY t.created_at DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [productId]
  );
  return rows;
}

async function listLowStock() {
  const [rows] = await pool.execute(
    `SELECT p.id, p.name, p.sku, p.quantity, p.reorder_level, c.name AS category
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.is_active = TRUE AND p.quantity < p.reorder_level
     ORDER BY (p.reorder_level - p.quantity) DESC` // most urgent first
  );
  return rows;
}

module.exports = {
  list, findById, findBySku, create, update, softDelete,
  listTransactions, listLowStock,
};
