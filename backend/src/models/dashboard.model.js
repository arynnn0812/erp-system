// Dashboard aggregation queries. Each is a single GROUP BY/aggregate -
// the DB does the math, the API just shapes JSON.
const { pool } = require('../config/db');

// Card counters for the top of the dashboard.
async function counters() {
  // One round-trip: scalar subqueries instead of 5 separate queries.
  const [rows] = await pool.execute(
    `SELECT
      (SELECT COALESCE(SUM(grand_total),0) FROM orders WHERE status='CONFIRMED') AS total_revenue,
      (SELECT COUNT(*) FROM orders WHERE status='CONFIRMED')                     AS total_orders,
      (SELECT COUNT(*) FROM products WHERE is_active=TRUE)                       AS total_products,
      (SELECT COUNT(*) FROM products WHERE is_active=TRUE
        AND quantity < reorder_level)                                            AS low_stock_count,
      (SELECT COUNT(*) FROM customers)                                           AS total_customers,
      (SELECT COUNT(*) FROM employees)                                           AS total_employees`
  );
  return rows[0];
}

// Monthly sales trend for the line chart (last N months).
async function monthlySalesTrend(months = 6) {
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(order_date, '%Y-%m') AS month,
            COUNT(*)                         AS orders,
            COALESCE(SUM(grand_total), 0)    AS revenue
     FROM orders
     WHERE status = 'CONFIRMED'
       AND order_date >= DATE_SUB(CURDATE(), INTERVAL ${Number(months)} MONTH)
     GROUP BY DATE_FORMAT(order_date, '%Y-%m')
     ORDER BY month`
  );
  return rows;
}

// Category-wise revenue for the pie/bar chart.
async function categorySales() {
  const [rows] = await pool.execute(
    `SELECT c.name AS category,
            COALESCE(SUM(oi.line_total), 0) AS revenue,
            COALESCE(SUM(oi.quantity), 0)   AS units_sold
     FROM categories c
     LEFT JOIN products p     ON p.category_id = c.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o       ON o.id = oi.order_id AND o.status = 'CONFIRMED'
     GROUP BY c.id, c.name
     ORDER BY revenue DESC`
  );
  return rows;
}

module.exports = { counters, monthlySalesTrend, categorySales };
