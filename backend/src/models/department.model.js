const { pool } = require('../config/db');

async function listAll() {
  const [rows] = await pool.execute(
    `SELECT d.id, d.name, COUNT(e.id) AS employee_count
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id
     GROUP BY d.id, d.name
     ORDER BY d.name`
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT * FROM departments WHERE id = ?', [id]);
  return rows[0] || null;
}

async function findByName(name) {
  const [rows] = await pool.execute('SELECT * FROM departments WHERE name = ?', [name]);
  return rows[0] || null;
}

async function create(name) {
  const [result] = await pool.execute('INSERT INTO departments (name) VALUES (?)', [name]);
  return result.insertId;
}

async function update(id, name) {
  const [result] = await pool.execute('UPDATE departments SET name = ? WHERE id = ?', [name, id]);
  return result.affectedRows > 0;
}

async function remove(id) {
  // FK from employees protects against deleting a non-empty department
  const [result] = await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { listAll, findById, findByName, create, update, remove };
