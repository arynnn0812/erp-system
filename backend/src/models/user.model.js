// All SQL touching the users table lives here.
// Always parameterized (?) - mysql2 sends values separately from the SQL
// text, so user input can never be executed as SQL (blocks SQL injection).
const { pool } = require('../config/db');

async function findByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.password_hash, u.is_active,
            r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
    [email]
  );
  return rows[0] || null; // undefined -> null, one clear "not found" value
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.is_active, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function create({ name, email, passwordHash, roleName }) {
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?))`,
    [name, email, passwordHash, roleName]
  );
  return result.insertId;
}

async function listAll() {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.is_active, r.name AS role, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
  );
  return rows;
}

module.exports = { findByEmail, findById, create, listAll };
