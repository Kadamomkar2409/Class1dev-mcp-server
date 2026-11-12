import { pool } from '../src/db/index.js';

async function main() {
  const u = await pool.query('SELECT count(*) FROM users');
  const r = await pool.query('SELECT count(*) FROM records');
  const a = await pool.query('SELECT count(*) FROM audit_logs');
  console.log(`Neon Database Counts -> Users: ${u.rows[0].count}, Records: ${r.rows[0].count}, Audit Logs: ${a.rows[0].count}`);
  await pool.end();
}

main().catch(err => {
  console.error('Failed to query counts:', err);
  process.exit(1);
});
