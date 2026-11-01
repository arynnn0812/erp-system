// Read side of the append-only audit_logs table (writes go through
// utils/audit.js). ADMIN-only; see routes/audit.routes.js.
const { pool } = require('../config/db');

async function list({ action, userId, entity, from, to, page = 1, limit = 25 }) {
  const where = [];
  const params = [];
  if (action) { where.push('a.action = ?'); params.push(action); }
  if (userId) { where.push('a.user_id = ?'); params.push(userId); }
  if (entity) { where.push('a.entity = ?'); params.push(entity); }
  // Dates are whole days: "to" includes everything on that day.
  if (from) { where.push('a.created_at >= ?'); params.push(from); }
  if (to) { where.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM audit_logs a ${whereSql}`, params);
  const [rows] = await pool.execute(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.ip_address, a.created_at,
            a.user_id, u.name AS user_name, u.email AS user_email
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${whereSql}
     ORDER BY a.id DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  return { rows, total, page: Number(page), pages: Math.ceil(total / limit) };
}

// Distinct action names for the filter dropdown (served by idx_audit_action_date).
async function actions() {
  const [rows] = await pool.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  return rows.map((r) => r.action);
}

module.exports = { list, actions };
