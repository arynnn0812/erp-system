// Read-side SQL for orders and sales reports. (Order CREATION lives in
// order.service.js because it needs a multi-statement transaction.)
const { pool } = require('../config/db');

async function list({ from, to, status, customerId, page = 1, limit = 10 }) {
  const where = [];
  const params = [];
  if (from)       { where.push('o.order_date >= ?'); params.push(from); }
  if (to)         { where.push('o.order_date <= ?'); params.push(to); }
  if (status)     { where.push('o.status = ?');      params.push(status); }
  if (customerId) { where.push('o.customer_id = ?'); params.push(customerId); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM orders o ${whereSql}`, params
  );
  const [rows] = await pool.execute(
    `SELECT o.id, o.order_date, o.status, o.subtotal, o.tax, o.discount,
            o.grand_total, c.name AS customer, u.name AS created_by,
            COUNT(oi.id) AS item_count
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN users u ON u.id = o.created_by
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${whereSql}
     GROUP BY o.id, o.order_date, o.status, o.subtotal, o.tax, o.discount,
              o.grand_total, c.name, u.name
     ORDER BY o.order_date DESC, o.id DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  return { rows, total, page: Number(page), pages: Math.ceil(total / limit) };
}

async function findById(id) {
  const [orders] = await pool.execute(
    `SELECT o.*, c.name AS customer, u.name AS created_by_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN users u ON u.id = o.created_by
     WHERE o.id = ?`,
    [id]
  );
  if (!orders[0]) return null;

  const [items] = await pool.execute(
    `SELECT oi.product_id, p.name, p.sku, oi.quantity, oi.unit_price, oi.line_total
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [id]
  );
  return { ...orders[0], items };
}

// Revenue + order count for a date range. Only CONFIRMED orders count.
async function salesSummary({ from, to }) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*)                    AS order_count,
            COALESCE(SUM(grand_total), 0) AS revenue,
            COALESCE(AVG(grand_total), 0) AS avg_order_value
     FROM orders
     WHERE status = 'CONFIRMED' AND order_date BETWEEN ? AND ?`,
    [from, to]
  );
  return rows[0];
}

async function topProducts({ from, to, limit = 5 }) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.name, p.sku,
            SUM(oi.quantity)   AS units_sold,
            SUM(oi.line_total) AS revenue
     FROM order_items oi
     JOIN orders o   ON o.id = oi.order_id
     JOIN products p ON p.id = oi.product_id
     WHERE o.status = 'CONFIRMED' AND o.order_date BETWEEN ? AND ?
     GROUP BY p.id, p.name, p.sku
     ORDER BY units_sold DESC
     LIMIT ${Number(limit)}`,
    [from, to]
  );
  return rows;
}

module.exports = { list, findById, salesSummary, topProducts };
