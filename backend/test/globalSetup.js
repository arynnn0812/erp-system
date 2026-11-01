// Runs once before all test files: recreate the test database from migrations.
const mysql = require('mysql2/promise');

module.exports = async function globalSetup() {
  const name = process.env.DB_NAME;
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to reset "${name}": test database name must contain "test"`);
  }
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await conn.end();

  const { migrate } = require('../scripts/migrate');
  await migrate({ log: () => {} });
};
