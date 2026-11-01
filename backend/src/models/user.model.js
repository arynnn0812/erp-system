// All SQL touching the users table lives here.
// Always parameterized (?) - mysql2 sends values separately from the SQL
// text, so user input can never be executed as SQL (blocks SQL injection).
const { pool } = require('../config/db');

async function findByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.password_hash, u.is_active, u.token_version,
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
    `SELECT u.id, u.name, u.email, u.is_active, r.name AS role, u.created_at,
            e.id AS employee_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.user_id = u.id
     ORDER BY u.id`
  );
  return rows;
}

// Hot path: runs on every authenticated request (primary-key lookup).
async function findAuthState(id) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.is_active, u.token_version, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findPasswordHash(id) {
  const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [id]);
  return rows[0]?.password_hash ?? null;
}

// Each write below that changes who may act also bumps token_version, which
// invalidates every token issued before it.
async function updatePassword(id, passwordHash) {
  await pool.execute(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
    [passwordHash, id]
  );
}

async function updateAccess(id, { roleName, isActive }) {
  const [result] = await pool.execute(
    `UPDATE users
     SET role_id = COALESCE((SELECT id FROM roles WHERE name = ?), role_id),
         is_active = COALESCE(?, is_active),
         token_version = token_version + 1
     WHERE id = ?`,
    [roleName ?? null, isActive ?? null, id]
  );
  return result.affectedRows > 0;
}

async function bumpTokenVersion(id) {
  await pool.execute('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]);
}

module.exports = {
  findByEmail, findById, create, listAll,
  findAuthState, findPasswordHash, updatePassword, updateAccess, bumpTokenVersion,
};
