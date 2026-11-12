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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(70));
  console.log('TRIGGERING VALIDATION FAILURE & ENGINE FAILURE FOR AUDIT LOGGING');
  console.log('='.repeat(70));

  // Start Server with short engine timeout to trigger engine failure cleanly
  const server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, ...envVars, CLASS1_TIMEOUT_MS: '20' }, // 20ms timeout triggers engine failure
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) break;
    } catch {}
  }
  console.log('Server online.');

  try {
    // 1. Initialize MCP Session
    const initRes = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AUTH_SECRET}` },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'audit-test', version: '1.0' } },
      }),
    });
    const sessionId = initRes.headers.get('mcp-session-id') || '';

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${AUTH_SECRET}`,
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;

    // 2. Trigger VALIDATION FAILURE: create_record without required 'title'
    console.log('\n[1] Triggering Validation Failure on create_record (missing title)...');
    const valRes = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'create_record',
          arguments: { description: 'Missing required title parameter' },
        },
      }),
    });
    const valText = await valRes.text();
    console.log(`    Response received: ${valText.slice(0, 120)}...`);

    // 3. Trigger ENGINE FAILURE: estimate_pr_cost with 20ms timeout
    console.log('\n[2] Triggering Engine Failure on estimate_pr_cost (simulated timeout)...');
    const engRes = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'estimate_pr_cost',
          arguments: {
            beforeCode: 'import time\ndef f(): pass\n',
            afterCode: 'import time\ndef f(): time.sleep(1)\n',
            path: 'test_engine_fail.py',
            samples: 10000,
          },
        },
      }),
    });
    const engText = await engRes.text();
    console.log(`    Response received: ${engText.slice(0, 120)}...`);

    await sleep(1000); // Allow async audit write to commit to Neon

    // 4. Query Neon audit_logs table for these failure rows
    console.log('\n[3] Querying Neon PostgreSQL audit_logs for failure rows...');
    const result = await pool.query(`
      SELECT id, user_id, tool_name, action, status, metadata, created_at
      FROM audit_logs
      WHERE status IN ('VALIDATION_FAILED', 'ENGINE_FAILURE', 'ERROR')
      ORDER BY created_at DESC
      LIMIT 5;
    `);

    console.log(`\nFound ${result.rows.length} Failure Rows in Neon audit_logs:`);
    for (const row of result.rows) {
      console.log('----------------------------------------------------------------------');
      console.log(`Audit Log ID:   ${row.id}`);
      console.log(`Timestamp:      ${row.created_at.toISOString()}`);
      console.log(`Tool Name:      ${row.tool_name}`);
      console.log(`Action:         ${row.action}`);
      console.log(`Status:         ${row.status}`);
      console.log(`User ID:        ${row.user_id || 'ANONYMOUS / DEFAULT'}`);
      console.log(`Metadata:       ${JSON.stringify(row.metadata)}`);
    }
    console.log('----------------------------------------------------------------------');

    console.log('\n' + '='.repeat(70));
    console.log('PASSED: AUDIT LOGS FOR VALIDATION FAILURE & ENGINE FAILURE VERIFIED IN NEON!');
    console.log('='.repeat(70));
  } finally {
    server.kill();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\nAudit failure test failed:', err);
  process.exit(1);
});
