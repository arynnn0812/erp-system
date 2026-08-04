// Seed script: creates one demo user per role.
// Run once after loading schema.sql:  node scripts/seed.js
// (A script, not raw SQL, because bcrypt hashes must be generated in code.)
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

const DEMO_PASSWORD = 'Password@123'; // demo only - change in production

const users = [
  { name: 'Admin User',    email: 'admin@erp.com',    role: 'ADMIN' },
  { name: 'HR User',       email: 'hr@erp.com',       role: 'HR' },
  { name: 'Manager User',  email: 'manager@erp.com',  role: 'MANAGER' },
  { name: 'Employee User', email: 'employee@erp.com', role: 'EMPLOYEE' },
];

async function seed() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of users) {
    // INSERT IGNORE: skip if the email already exists (script is re-runnable)
    await pool.execute(
      `INSERT IGNORE INTO users (name, email, password_hash, role_id)
       VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = ?))`,
      [u.name, u.email, hash, u.role]
    );
    console.log(`seeded ${u.role.padEnd(8)} ${u.email}`);
  }

  console.log(`\nAll demo accounts use password: ${DEMO_PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
