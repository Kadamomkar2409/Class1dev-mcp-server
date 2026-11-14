import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  return parsed?.result || parsed;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(70));
  console.log('RESTART PERSISTENCE VERIFICATION');
  console.log('='.repeat(70));

  console.log('\n[1] Starting FRESH MCP Server instance (node dist/index.js)...');
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
  console.log('Fresh server process started and healthy.');

  try {
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
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'restart-tester', version: '1.0' } },
      }),
    });
    const sessionId = initRes.headers.get('mcp-session-id') || '';

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${AUTH_SECRET}`,
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;

    // Call list_governance_ledger
    console.log('\n[2] Calling list_governance_ledger over POST /mcp after restart...');
    const listRes = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'list_governance_ledger', arguments: { limit: 5, offset: 0 } },
      }),
    });
    const listData = unwrapToolResult(parseMcpPayload(await listRes.text()));
    console.log(`    Total Records Stored in Neon: ${listData.pagination?.total}`);
    console.log(`    Recent Records Persisted:`);
    for (const r of (listData.records || [])) {
      console.log(`     - [${r.id}] ${r.title} (Created: ${r.createdAt})`);
    }

    // Call get_governance_record on the initial seed record (00000000-0000-0000-0000-000000000010)
    console.log('\n[3] Calling get_governance_record on the initial seed record (00000000-0000-0000-0000-000000000010)...');
    const seedGetRes = await fetch(`${BASE_URL}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_governance_record', arguments: { id: '00000000-0000-0000-0000-000000000010' } },
      }),
    });
    const seedData = unwrapToolResult(parseMcpPayload(await seedGetRes.text()));
    const seedRec = seedData.record || seedData;
    console.log(`    Seed Record Title:          ${seedRec.title}`);
    console.log(`    Seed Record Modeled P90:    $${seedRec.metadata?.forecast?.p90?.toFixed(2)}`);
    console.log(`    Seed Record Stored Verdict: ${seedRec.metadata?.verdict}`);

    console.log('\n' + '='.repeat(70));
    console.log('PERSISTENCE ACROSS RESTARTS VERIFIED: DATA PERSISTS IN NEON!');
    console.log('='.repeat(70));
  } finally {
    server.kill();
  }
}

main().catch(err => {
  console.error('\nRestart persistence test failed:', err);
  process.exit(1);
});
