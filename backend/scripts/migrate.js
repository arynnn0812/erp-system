// Migration runner: applies database/migrations/*.sql in filename order and
// records each one in schema_migrations, so running it twice is a no-op.
//   npm run migrate
// No migration library: plain SQL files are easy to review, and this file is
// the whole mechanism. MySQL auto-commits DDL, so a migration is not wrapped
// in a transaction - keep each file small and forward-only.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config/env');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'database', 'migrations');

async function migrate({ log = console.log } = {}) {
  // Connect without a database first so a fresh server can be bootstrapped.
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true, // a migration file holds many statements
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.name}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${config.db.name}\``);

    const [[{ hasLedger }]] = await conn.query(
      `SELECT COUNT(*) AS hasLedger FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'`
    );
    const [[{ hasUsers }]] = await conn.query(
      `SELECT COUNT(*) AS hasUsers FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'users'`
    );

    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name        VARCHAR(255) PRIMARY KEY,
         applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB`
    );

    // Databases created from the old schema.sql already contain 001's tables.
    // Record it as applied instead of failing on "table already exists".
    if (!hasLedger && hasUsers) {
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', ['001_initial_schema.sql']);
      log('baseline: existing schema detected, marked 001_initial_schema.sql as applied');
    }

    const [doneRows] = await conn.query('SELECT name FROM schema_migrations');
    const done = new Set(doneRows.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    let applied = 0;
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      log(`applied ${file}`);
      applied += 1;
    }
    if (applied === 0) log('database is up to date');
    return applied;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error('[migrate] failed:', err.message);
    process.exit(1);
  });
}

module.exports = { migrate };
