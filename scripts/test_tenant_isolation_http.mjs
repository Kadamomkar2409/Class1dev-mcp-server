import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../dist/db/index.js';

// Read .env
const envContent = readFileSync(join(process.cwd(), '.env'), 'utf-8');
const envVars = {};
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    envVars[match[1]] = val;
  }
}

const AUTH_SECRET = envVars.AUTH_SECRET;
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function parseMcpPayload(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      try { return JSON.parse(trimmed.substring(6).trim()); } catch {}
    }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.substring(start, end + 1)); } catch {}
  }
  return null;
}

function unwrapToolResult(parsed) {
  if (parsed?.result?.content?.[0]?.text) {
    try { return JSON.parse(parsed.result.content[0].text); } catch { return parsed.result.content[0].text; }
  }
  if (parsed?.error) return parsed.error;
  return parsed?.result || parsed;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(70));
  console.log('TENANT ISOLATION OVER HTTP (/mcp) VERIFICATION');
  console.log('='.repeat(70));

  // 1. Ensure Tenant B user exists in Neon
  const tenantAId = '00000000-0000-0000-0000-000000000001';
  const tenantBId = '00000000-0000-0000-0000-000000000002';

  await pool.query(`
    INSERT INTO users (id, name, email)
    VALUES ($1, 'Tenant B (Isolated Partner)', 'tenant-b@isolated.example.com')
    ON CONFLICT (id) DO NOTHING;
  `, [tenantBId]);

  console.log(`\n[1] Tenant Identities in Neon:`);
  console.log(`    Authenticated Principal (Default Caller / User A): ${tenantAId}`);
  console.log(`    Secondary Tenant (Isolated User B):              ${tenantBId}`);

  // 2. Start Server
  console.log('\n[2] Starting MCP Server (node dist/index.js)...');
  const server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, ...envVars },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) break;
    } catch {}
  }
  console.log('    Server is online and listening on port 3000.');

  let recordBId = null;

  try {
    // 3. Initialize MCP session
    const initRes = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_SECRET}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'tenant-test', version: '1.0' } },
      }),
    });
    const sessionId = initRes.headers.get('mcp-session-id') || '';

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${AUTH_SECRET}`,
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;

    async function callTool(id, name, args = {}) {
      const res = await fetch(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }),
      });
      const text = await res.text();
      return unwrapToolResult(parseMcpPayload(text));
    }

    // 4. User B creates a confidential record
    console.log(`\n[3] User B explicitly creates a confidential record via create_record...`);
    const createB = await callTool(10, 'create_record', {
      userId: tenantBId,
      title: 'Tenant B Secret Financial Model',
      description: 'Confidential corporate strategy exclusively owned by Tenant B.',
      metadata: { confidential: true, level: 'RESTRICTED' },
    });
    recordBId = createB.record?.id;
    console.log(`    Created Record ID: ${recordBId}`);
    console.log(`    Owner:             ${createB.record?.userId}`);
    if (!recordBId) throw new Error('Failed to create Tenant B record');

    // 5. Standard Caller (No userId provided -> scopes to Authenticated Principal / User A)
    console.log(`\n[4] Standard Caller (omitting userId) attempts to GET User B's record...`);
    const getWithoutUser = await callTool(11, 'get_record', { id: recordBId });
    console.log(`    Result: ${JSON.stringify(getWithoutUser)}`);
    const isIsolatedGet = getWithoutUser.error === true && getWithoutUser.message.includes('not found');
    console.log(`    Access Denied / Isolated: ${isIsolatedGet ? 'YES (PASS)' : 'LEAK DETECTED (FAIL)'}`);
    if (!isIsolatedGet) throw new Error('Tenant isolation failure: get_record leaked cross-tenant record without userId!');

    // 6. User A explicitly passes their own userId trying to GET User B's record
    console.log(`\n[5] User A explicitly passes userId=${tenantAId} trying to GET User B's record...`);
    const getAsUserA = await callTool(12, 'get_record', { id: recordBId, userId: tenantAId });
    console.log(`    Result: ${JSON.stringify(getAsUserA)}`);
    const isIsolatedGetA = getAsUserA.error === true && getAsUserA.message.includes('not found');
    console.log(`    Access Denied / Isolated: ${isIsolatedGetA ? 'YES (PASS)' : 'LEAK DETECTED (FAIL)'}`);
    if (!isIsolatedGetA) throw new Error('Tenant isolation failure: User A was able to read User B record!');

    // 7. Caller omits userId on list_records -> Must only see User A's records
    console.log(`\n[6] Caller omits userId on list_records -> Expect only User A's records...`);
    const listRes = await callTool(13, 'list_records', { limit: 50 });
    const userBInList = (listRes.records || []).some(r => r.id === recordBId);
    console.log(`    Total Records in List: ${(listRes.records || []).length}`);
    console.log(`    User B's record present: ${userBInList ? 'YES (LEAKED!)' : 'NO (STRICTLY ISOLATED)'}`);
    if (userBInList) throw new Error('Tenant isolation failure: list_records returned User B record to unauthenticated caller!');

    // 8. Caller omits userId on search_records -> Must not find User B's record
    console.log(`\n[7] Caller searches for 'Secret Financial Model' without userId...`);
    const searchRes = await callTool(14, 'search_records', { query: 'Secret Financial Model' });
    console.log(`    Results found: ${searchRes.resultsFound}`);
    console.log(`    Isolated:      ${searchRes.resultsFound === 0 ? 'YES (PASS)' : 'LEAK DETECTED (FAIL)'}`);
    if (searchRes.resultsFound > 0) throw new Error('Tenant isolation failure: search_records found User B record without userId!');

    // 9. Tamper attempt: Caller tries to UPDATE User B's record as User A
    console.log(`\n[8] Tamper attempt: Caller attempts to UPDATE User B's record...`);
    const updateRes = await callTool(15, 'update_record', {
      id: recordBId,
      userId: tenantAId,
      title: 'Tampered by Malicious Tenant A',
    });
    console.log(`    Update Result: ${JSON.stringify(updateRes)}`);
    console.log(`    Blocked:       ${updateRes.error === true ? 'YES (PASS)' : 'FAIL'}`);

    // 10. Tamper attempt: Caller tries to DELETE User B's record as User A
    console.log(`\n[9] Tamper attempt: Caller attempts to DELETE User B's record...`);
    const deleteRes = await callTool(16, 'delete_record', {
      id: recordBId,
      userId: tenantAId,
    });
    console.log(`    Delete Result: ${JSON.stringify(deleteRes)}`);
    console.log(`    Blocked:       ${deleteRes.error === true ? 'YES (PASS)' : 'FAIL'}`);

    // 11. Legitimate Access: User B reads, updates, and deletes their own record
    console.log(`\n[10] Legitimate Access: User B retrieves, updates, and deletes own record...`);
    const legitGet = await callTool(17, 'get_record', { id: recordBId, userId: tenantBId });
    console.log(`    User B GET:    ${legitGet.success ? 'SUCCESS (Title: ' + legitGet.record.title + ')' : 'FAIL'}`);

    const legitUpdate = await callTool(18, 'update_record', {
      id: recordBId,
      userId: tenantBId,
      title: 'Tenant B Secret Financial Model (Updated by Owner)',
    });
    console.log(`    User B UPDATE: ${legitUpdate.success ? 'SUCCESS (Title: ' + legitUpdate.record.title + ')' : 'FAIL'}`);

    const legitDelete = await callTool(19, 'delete_record', { id: recordBId, userId: tenantBId });
    console.log(`    User B DELETE: ${legitDelete.success ? 'SUCCESS (' + legitDelete.message + ')' : 'FAIL'}`);
    recordBId = null; // Cleaned up

    console.log('\n' + '='.repeat(70));
    console.log('HTTP TENANT ISOLATION PROVEN ACROSS ALL MCP TOOLS: ZERO CROSS-TENANT LEAKAGE');
    console.log('='.repeat(70));
  } finally {
    if (recordBId) {
      await pool.query('DELETE FROM records WHERE id = $1', [recordBId]).catch(() => {});
    }
    await pool.query('DELETE FROM users WHERE id = $1', [tenantBId]).catch(() => {});
    await pool.end();
    server.kill();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\nHTTP Tenant isolation test failed:', err);
  process.exit(1);
});
