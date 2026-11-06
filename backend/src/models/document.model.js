const { pool } = require('../config/db');

async function create(d) {
  const [result] = await pool.execute(
    `INSERT INTO documents (owner_type, owner_id, file_name, s3_key, mime_type, size_bytes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [d.ownerType, d.ownerId, d.fileName, d.s3Key, d.mimeType, d.sizeBytes, d.uploadedBy]
  );
  return result.insertId;
}

async function findById(id) {
  const [rows] = await pool.execute('SELECT * FROM documents WHERE id = ?', [id]);
  return rows[0] || null;
}

async function listByOwner(ownerType, ownerId) {
  const [rows] = await pool.execute(
    `SELECT d.id, d.file_name, d.mime_type, d.size_bytes, d.created_at,
            u.name AS uploaded_by
     FROM documents d
     JOIN users u ON u.id = d.uploaded_by
     WHERE d.owner_type = ? AND d.owner_id = ?
     ORDER BY d.created_at DESC`,
    [ownerType, ownerId]
  );
  return rows;
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM documents WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function countByOwner(ownerType, ownerId) {
  const [[{ n }]] = await pool.execute(
    'SELECT COUNT(*) AS n FROM documents WHERE owner_type = ? AND owner_id = ?',
    [ownerType, ownerId]
  );
  return n;
}

module.exports = { create, findById, listByOwner, remove, countByOwner };
