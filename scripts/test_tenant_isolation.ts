import { db } from '../dist/db/index.js';
import { users, records } from '../dist/db/schema.js';
import { recordService } from '../dist/services/record.service.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

async function main() {
  console.log('='.repeat(70));
  console.log('TENANT ISOLATION VERIFICATION SUITE');
  console.log('='.repeat(70));

  // Generate distinct UUIDs for User A and User B
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();

  console.log(`\n[1] Creating Test Users:`);
  console.log(`    User A: ${userAId}`);
  console.log(`    User B: ${userBId}`);

  await db.insert(users).values([
    { id: userAId, email: `tenant-a-${Date.now()}@example.com`, name: 'Tenant A' },
    { id: userBId, email: `tenant-b-${Date.now()}@example.com`, name: 'Tenant B' },
  ]);

  try {
    // 1. User A creates a private record
    console.log(`\n[2] User A creates a record...`);
    const recordA = await recordService.createRecord({
      userId: userAId,
      title: 'User A Confidential Strategy & Cost Model',
      description: 'Private budget data owned exclusively by User A.',
      metadata: { classification: 'RESTRICTED', owner: 'User A' },
    });
    console.log(`    Created Record ID: ${recordA.id}`);
    console.log(`    Owner:             ${recordA.userId}`);

    // 2. User B tries to GET User A's record
    console.log(`\n[3] User B attempts to GET User A's record...`);
    const getResultByUserB = await recordService.getRecord(recordA.id, userBId);
    console.log(`    Result for User B: ${getResultByUserB === null ? 'NULL (ACCESS DENIED / ISOLATED)' : 'LEAKED!'}`);
    if (getResultByUserB !== null) throw new Error('Tenant isolation violated on getRecord!');

    // 3. User B tries to UPDATE User A's record
    console.log(`\n[4] User B attempts to UPDATE User A's record...`);
    let updateBlocked = false;
    try {
      await recordService.updateRecord({
        id: recordA.id,
        userId: userBId,
        title: 'Tampered by User B',
      });
    } catch (err: any) {
      updateBlocked = true;
      console.log(`    Correctly Blocked: ${err.message}`);
    }
    if (!updateBlocked) throw new Error('Tenant isolation violated on updateRecord!');

    // 4. User B tries to DELETE User A's record
    console.log(`\n[5] User B attempts to DELETE User A's record...`);
    let deleteBlocked = false;
    try {
      await recordService.deleteRecord(recordA.id, userBId);
    } catch (err: any) {
      deleteBlocked = true;
      console.log(`    Correctly Blocked: ${err.message}`);
    }
    if (!deleteBlocked) throw new Error('Tenant isolation violated on deleteRecord!');

    // 5. User B LISTS records (scoped to User B)
    console.log(`\n[6] User B LISTS records (scoped to User B)...`);
    const listResultUserB = await recordService.listRecords({ userId: userBId });
    const userAFoundInList = listResultUserB.records.some(r => r.id === recordA.id);
    console.log(`    Records returned for User B: ${listResultUserB.records.length}`);
    console.log(`    User A record present:       ${userAFoundInList ? 'YES (LEAKED!)' : 'NO (ISOLATED)'}`);
    if (userAFoundInList) throw new Error('Tenant isolation violated on listRecords!');

    // 6. User B SEARCHES records (scoped to User B)
    console.log(`\n[7] User B SEARCHES for "Confidential Strategy" (scoped to User B)...`);
    const searchResultUserB = await recordService.searchRecords({
      query: 'Confidential Strategy',
      userId: userBId,
    });
    console.log(`    Results found for User B:   ${searchResultUserB.resultsFound}`);
    if (searchResultUserB.resultsFound > 0) throw new Error('Tenant isolation violated on searchRecords!');

    // 7. Verify User A retains full legitimate access
    console.log(`\n[8] User A reads, updates, and deletes own record...`);
    const getResultUserA = await recordService.getRecord(recordA.id, userAId);
    console.log(`    User A GET:    ${getResultUserA?.title === recordA.title ? 'SUCCESS' : 'FAILED'}`);

    const updatedByA = await recordService.updateRecord({
      id: recordA.id,
      userId: userAId,
      title: 'User A Confidential Strategy (Legitimately Updated)',
    });
    console.log(`    User A UPDATE: ${updatedByA.title}`);

    const deleteByA = await recordService.deleteRecord(recordA.id, userAId);
    console.log(`    User A DELETE: ${deleteByA.message}`);

    console.log('\n' + '='.repeat(70));
    console.log('TENANT ISOLATION FULLY VERIFIED ACROSS GET, UPDATE, DELETE, LIST, SEARCH!');
    console.log('='.repeat(70));
  } finally {
    // Clean up test users
    await db.delete(users).where(eq(users.id, userAId));
    await db.delete(users).where(eq(users.id, userBId));
  }
  process.exit(0);
}

main().catch(err => {
  console.error('\nTenant isolation test failed:', err);
  process.exit(1);
});

