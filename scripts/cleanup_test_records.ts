import { db } from '../dist/db/index.js';
import { records } from '../dist/db/schema.js';
import { notInArray } from 'drizzle-orm';

const SEED_RECORD_1_ID = '00000000-0000-0000-0000-000000000010';
const SEED_RECORD_2_ID = '00000000-0000-0000-0000-000000000020';

async function main() {
  console.log('🧹 Cleaning up leftover test records in Neon PostgreSQL...');
  
  const deleted = await db
    .delete(records)
    .where(notInArray(records.id, [SEED_RECORD_1_ID, SEED_RECORD_2_ID]))
    .returning({ id: records.id, title: records.title });

  console.log(`Deleted ${deleted.length} leftover test records:`);
  for (const d of deleted) {
    console.log(` - [${d.id}] ${d.title}`);
  }

  const remaining = await db.select().from(records);
  console.log(`\nRemaining baseline records in Neon (${remaining.length}):`);
  for (const r of remaining) {
    console.log(` * [${r.id}] ${r.title} (User: ${r.userId})`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});

