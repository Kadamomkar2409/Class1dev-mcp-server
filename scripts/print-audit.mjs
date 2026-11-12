import { db } from '../dist/db/index.js';
import { auditLogs } from '../dist/db/schema.js';
import { desc } from 'drizzle-orm';

async function main() {
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(15);
  console.log('--- RECENT AUDIT LOGS IN NEON POSTGRESQL ---');
  for (const log of logs) {
    const user = log.userId ? log.userId.substring(0, 8) + '...' : 'ANONYMOUS';
    console.log(`[${log.createdAt.toISOString()}] ${log.toolName.padEnd(20)} | ${log.action.padEnd(10)} | ${log.status.padEnd(8)} | ${user}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Audit query error:', err);
  process.exit(1);
});

