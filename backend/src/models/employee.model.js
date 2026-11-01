// Employee SQL with FIELD-LEVEL access control: salary is only selected
// for roles allowed to see it. The restriction lives in the query itself -
// data that never leaves the DB can't leak.
const { pool } = require('../config/db');

const BASE_FIELDS = `e.id, e.name, e.email, e.designation, e.joining_date,
                     d.id AS department_id, d.name AS department`;
const SALARY_FIELD = ', e.salary';

// ADMIN and HR see salary; MANAGER (and everyone else) does not.
const canSeeSalary = (role) => role === 'ADMIN' || role === 'HR';

async function list({ departmentId, search, page = 1, limit = 10 }, role) {
  const fields = BASE_FIELDS + (canSeeSalary(role) ? SALARY_FIELD : '');
  const where = [];
  const params = [];
  if (departmentId) { where.push('e.department_id = ?'); params.push(departmentId); }
  if (search) {
    where.push('(e.name LIKE ? OR e.email LIKE ? OR e.designation LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM employees e ${whereSql}`, params
  );
  const [rows] = await pool.execute(
    `SELECT ${fields}
     FROM employees e
     JOIN departments d ON d.id = e.department_id
     ${whereSql}
     ORDER BY e.name
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    params
  );
  return { rows, total, page: Number(page), pages: Math.ceil(total / limit) };
}

async function findById(id, role) {
  const fields = BASE_FIELDS + (canSeeSalary(role) ? SALARY_FIELD : '');
  const [rows] = await pool.execute(
    `SELECT ${fields}, e.user_id
     FROM employees e JOIN departments d ON d.id = e.department_id
     WHERE e.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const [rows] = await pool.execute('SELECT id, user_id FROM employees WHERE email = ?', [email]);
  return rows[0] || null;
}

// Internal use (service needs old salary for the audit diff) - full row.
async function findRaw(id) {
  const [rows] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(e) {
  const [result] = await pool.execute(
    `INSERT INTO employees (user_id, name, email, department_id, designation, joining_date, salary)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [e.userId ?? null, e.name, e.email, e.departmentId, e.designation, e.joiningDate, e.salary]
  );
  return result.insertId;
}

async function update(id, e) {
  const [result] = await pool.execute(
    `UPDATE employees
     SET user_id = ?, name = ?, email = ?, department_id = ?, designation = ?, joining_date = ?, salary = ?
     WHERE id = ?`,
    [e.userId ?? null, e.name, e.email, e.departmentId, e.designation, e.joiningDate, e.salary, id]
  );
  return result.affectedRows > 0;
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM employees WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function findByUserId(userId) {
  const [rows] = await pool.execute('SELECT id FROM employees WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

module.exports = {
  list, findById, findByEmail, findByUserId, findRaw, create, update, remove, canSeeSalary,
};
