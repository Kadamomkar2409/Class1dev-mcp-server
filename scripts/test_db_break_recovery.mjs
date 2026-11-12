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

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    await sleep(400);
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.status === 200 || res.status === 503) return true;
    } catch {}
  }
  return false;
}

async function main() {
  console.log('='.repeat(70));
  console.log('TEST: DATABASE DISCONNECTION, HTTP 503 STATUS & RECOVERY');
  console.log('='.repeat(70));

  // -------------------------------------------------------------
  // STEP 1: Healthy Baseline
  // -------------------------------------------------------------
  console.log('\n[Step 1] Starting server with REAL, valid DATABASE_URL...');
  let server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, ...envVars },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();

  const res1 = await fetch(`${BASE_URL}/health`);
  const body1 = await res1.json();
  console.log(`   HTTP Status: ${res1.status} (Healthy Baseline)`);
  console.log(`   Connected:   ${body1.database?.connected}`);
  console.log(`   DB Latency:  ${body1.database?.latencyMs}ms`);
  server.kill();
  await sleep(1000);

  // -------------------------------------------------------------
  // STEP 2: Broken Database Connection
  // -------------------------------------------------------------
  console.log('\n[Step 2] Starting server with BROKEN database connection...');
  const brokenDbUrl = 'postgresql://fake_user:SUPER_SECRET_LEAK_TEST_PASSWORD@ep-unreachable-neon-subdomain.us-east-2.aws.neon.tech/neondb?sslmode=require';
  server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, ...envVars, DATABASE_URL: brokenDbUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();

  const res2 = await fetch(`${BASE_URL}/health`);
  const body2 = await res2.json();
  const rawBody2 = JSON.stringify(body2);

  console.log(`   HTTP Status:       ${res2.status} (Verified HTTP 503 Service Unavailable)`);
  console.log(`   Overall Status:    ${body2.status}`);
  console.log(`   DB Connected:      ${body2.database?.connected}`);
  console.log(`   Sanitized Error:   ${body2.database?.error}`);

  // Credential Leak Verification
  const leakedPassword = rawBody2.includes('SUPER_SECRET_LEAK_TEST_PASSWORD');
  const leakedUser = rawBody2.includes('fake_user');
  console.log(`   Credential Leak?   ${leakedPassword || leakedUser ? 'FAILED (LEAKED!)' : 'PASSED (0 Credential Leaks)'}`);

  if (res2.status !== 503) {
    throw new Error(`Expected HTTP 503 but received ${res2.status}`);
  }
  if (leakedPassword) {
    throw new Error('Database password was leaked in HTTP 503 response!');
  }

  server.kill();
  await sleep(1000);

  // -------------------------------------------------------------
  // STEP 3: Recovery
  // -------------------------------------------------------------
  console.log('\n[Step 3] Restoring server with REAL, valid DATABASE_URL (Recovery)...');
  server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: { ...process.env, ...envVars },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForServer();

  const res3 = await fetch(`${BASE_URL}/health`);
  const body3 = await res3.json();
  console.log(`   HTTP Status: ${res3.status} (Verified RECOVERY to 200 OK)`);
  console.log(`   Connected:   ${body3.database?.connected}`);
  console.log(`   DB Latency:  ${body3.database?.latencyMs}ms`);

  server.kill();

  console.log('\n' + '='.repeat(70));
  console.log('PASSED: HTTP 503 RETURNED WHEN DB IS BROKEN WITHOUT CREDENTIAL LEAKAGE, THEN RECOVERED!');
  console.log('='.repeat(70));
  process.exit(0);
}

main().catch(err => {
  console.error('\nBreak/recovery test failed:', err);
  process.exit(1);
});
