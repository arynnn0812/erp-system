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

// `db` lets the service run this inside its transaction (a pool connection).
async function create(p, db = pool) {
  const [result] = await db.execute(
    `INSERT INTO products (name, sku, category_id, price, quantity, reorder_level, supplier)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.sku, p.categoryId, p.price, p.quantity ?? 0, p.reorderLevel ?? 10, p.supplier ?? null]
  );
  return result.insertId;
}

async function update(id, p) {
  const [result] = await pool.execute(
    `UPDATE products
     SET name = ?, category_id = ?, price = ?,
         reorder_level = COALESCE(?, reorder_level), -- optional: omitted = unchanged
         supplier = ?
     WHERE id = ? AND is_active = TRUE`,
    [p.name, p.categoryId, p.price, p.reorderLevel ?? null, p.supplier ?? null, id]
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

// Stock ledger for one product, newest first, with the balance after each
// movement (a running sum over the whole ledger, so it is right on every page).
async function listTransactions(productId, { page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const [[{ total }]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM inventory_transactions WHERE product_id = ?', [productId]
  );
  const [rows] = await pool.execute(
    `SELECT * FROM (
       SELECT t.id, t.type, t.quantity, t.reference, t.created_at,
              u.name AS performed_by,
              SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE -t.quantity END)
                OVER (ORDER BY t.id) AS balance_after
       FROM inventory_transactions t
       JOIN users u ON u.id = t.performed_by
       WHERE t.product_id = ?
     ) ledger
     ORDER BY id DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [productId]
  );
  return { rows, total, page: Number(page), pages: Math.ceil(total / limit) };
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

// Reorder planning, computed in SQL from real order history.
//   units_sold      confirmed units in the last `days` days (including today)
//   daily_velocity  units_sold / days
//   days_of_stock   how long current stock lasts at that pace (NULL = no sales)
//   suggested_qty   enough to cover `cover` days of demand on top of the
//                   reorder level (kept as safety stock), minus what is on hand
// All three numbers are validated integers, interpolated like LIMIT elsewhere.
async function reorderPlan({ days = 30, cover = 30 }) {
  const d = Number(days);
  const c = Number(cover);
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.sku, p.quantity, p.reorder_level, p.supplier, p.price,
            c.name AS category,
            COALESCE(s.units, 0)                                   AS units_sold,
            ROUND(COALESCE(s.units, 0) / ${d}, 2)                  AS daily_velocity,
            CASE WHEN COALESCE(s.units, 0) = 0 THEN NULL
                 ELSE FLOOR(p.quantity / (s.units / ${d})) END     AS days_of_stock,
            GREATEST(0, CEIL(COALESCE(s.units, 0) / ${d} * ${c}
                             + p.reorder_level - p.quantity))      AS suggested_qty
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN (
       SELECT oi.product_id, SUM(oi.quantity) AS units
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status = 'CONFIRMED'
         AND o.order_date > DATE_SUB(CURDATE(), INTERVAL ${d} DAY)
       GROUP BY oi.product_id
     ) s ON s.product_id = p.id
     WHERE p.is_active = TRUE
     ORDER BY p.quantity = 0 DESC,
              p.quantity < p.reorder_level DESC,
              days_of_stock IS NULL, days_of_stock, p.name`
  );
  return rows;
}

module.exports = {
  reorderPlan,
  list, findById, findBySku, create, update, softDelete,
  listTransactions, listLowStock,
};
