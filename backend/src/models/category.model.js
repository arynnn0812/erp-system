const { pool } = require('../config/db');

async function listAll() {
  const [rows] = await pool.execute(
    `SELECT c.id, c.name, COUNT(p.id) AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
     GROUP BY c.id, c.name
     ORDER BY c.name`
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT * FROM categories WHERE id = ?', [id]);
  return rows[0] || null;
}

async function findByName(name) {
  const [rows] = await pool.execute('SELECT * FROM categories WHERE name = ?', [name]);
  return rows[0] || null;
}

async function create(name) {
  const [result] = await pool.execute('INSERT INTO categories (name) VALUES (?)', [name]);
  return result.insertId;
}

async function update(id, name) {
  const [result] = await pool.execute('UPDATE categories SET name = ? WHERE id = ?', [name, id]);
  return result.affectedRows > 0;
}

async function remove(id) {
  // Will throw ER_ROW_IS_REFERENCED if products still use this category -
  // the FK protects us; the service converts that to a friendly 409.
  const [result] = await pool.execute('DELETE FROM categories WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { listAll, findById, findByName, create, update, remove };
