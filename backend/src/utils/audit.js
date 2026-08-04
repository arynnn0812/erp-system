// Audit log helper. Fire-and-forget by design: a failed audit write should
// never break the business operation, so errors are logged, not thrown.
const { pool } = require('../config/db');

async function audit({ userId, action, entity, entityId, details, ip }) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId ?? null,
        action,
        entity ?? null,
        entityId ?? null,
        details ? JSON.stringify(details) : null,
        ip ?? null,
      ]
    );
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = audit;
