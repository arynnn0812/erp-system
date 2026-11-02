// Creates the first administrator of a production install, without the demo
// accounts and their published password that `npm run seed` creates.
//   ADMIN_NAME="Asha Rao" ADMIN_EMAIL=asha@example.com ADMIN_PASSWORD=... node scripts/create-admin.js
// The password is read from the environment, not an argument, so it stays out
// of `ps` output. In a shell: read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD
// It goes through the same validation and service as POST /api/auth/register,
// so the password rules and hashing are exactly the API's.
const { validationResult } = require('express-validator');
const { registerRules } = require('../src/validators/auth.validator');
const authService = require('../src/services/auth.service');
const { pool } = require('../src/config/db');

async function createAdmin() {
  const req = {
    body: {
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'ADMIN',
    },
  };
  for (const rule of registerRules) await rule.run(req); // also normalises (trim, lowercase email)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array({ onlyFirstError: true }).map((e) => `${e.path}: ${e.msg}`);
    throw new Error(`invalid input (set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD):\n  - ${messages.join('\n  - ')}`);
  }
  const user = await authService.register(req.body);
  console.log(`created administrator ${user.email} (id ${user.id})`);
}

createAdmin()
  .catch((err) => {
    console.error(`[create-admin] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
