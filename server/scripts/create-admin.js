require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool, initializeDatabase } = require('../db');

async function main() {
  const username = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (username.length < 3) throw new Error('Set ADMIN_USERNAME to a username with at least 3 characters.');
  if (password.length < 12) throw new Error('Set ADMIN_PASSWORD to a password with at least 12 characters.');
  await initializeDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO admins (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, passwordHash],
  );
  console.log(`Admin account "${username}" is ready.`);
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());
