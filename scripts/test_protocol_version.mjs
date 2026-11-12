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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(70));
  console.log('TESTING MCP SERVER WITHOUT NITRO_MCP_PROTOCOL_VERSION=legacy');
  console.log('='.repeat(70));

  // Spawn without NITRO_MCP_PROTOCOL_VERSION and explicitly setting NITRO_MCP_PROTOCOL_VERSION=current or unset
  const childEnv = { ...process.env, ...envVars };
  delete childEnv.NITRO_MCP_PROTOCOL_VERSION;

  // Let's spawn a node process running with an env flag or test index
  // Note: if src/index.ts has `if (!process.env.NITRO_MCP_PROTOCOL_VERSION) process.env.NITRO_MCP_PROTOCOL_VERSION = 'legacy';`,
  // we can pass NITRO_MCP_PROTOCOL_VERSION='2024-11-05' or 'latest' or delete it in a custom runner
  console.log('\n[1] Spawning server with NITRO_MCP_PROTOCOL_VERSION="2024-11-05" (Standard latest spec)...');
  const server = spawn('node', ['-e', `
    delete process.env.NITRO_MCP_PROTOCOL_VERSION;
    import('./dist/index.js');
  `], {
    cwd: process.cwd(),
    env: { ...childEnv, NITRO_MCP_PROTOCOL_VERSION: 'latest' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', d => console.log('[Server stdout]:', d.toString().trim()));
  server.stderr.on('data', d => console.log('[Server stderr]:', d.toString().trim()));

  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) break;
    } catch {}
  }

  try {
    console.log('\n[2] Sending JSON-RPC 2.0 initialize request to POST /mcp...');
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
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0' },
        },
      }),
    });

    const status = initRes.status;
    const text = await initRes.text();
    console.log(`    HTTP Status: ${status}`);
    console.log(`    Response:    ${text}`);

    if (status === 200 && text.includes('result')) {
      console.log('\nResult: PASSED without legacy flag!');
    } else {
      console.log('\nResult: FAILED without legacy flag!');
    }
  } finally {
    server.kill();
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
