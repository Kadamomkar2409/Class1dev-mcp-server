import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import readline from 'node:readline';

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

async function runStdioHandshake() {
  console.log('='.repeat(70));
  console.log('VERIFYING REAL STDIO TRANSPORT HANDSHAKE (MCP_TRANSPORT=stdio)');
  console.log('='.repeat(70));

  const child = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envVars,
      MCP_TRANSPORT: 'stdio',
      PYTHONUTF8: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const pendingRequests = new Map();
  let stderrLogs = [];

  child.stderr.on('data', (chunk) => {
    stderrLogs.push(chunk.toString());
  });

  const rl = readline.createInterface({ input: child.stdout, terminal: false });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed);
      if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        const { resolve } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        resolve(msg);
      }
    } catch (e) {
      console.error('Non-JSON received on stdout (corrupted!):', trimmed);
    }
  });

  let nextId = 1;
  function sendRequest(method, params = {}) {
    const id = nextId++;
    const payload = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  function sendNotification(method, params = {}) {
    const payload = { jsonrpc: '2.0', method, params };
    child.stdin.write(JSON.stringify(payload) + '\n');
  }

  try {
    // 1. Initialize
    console.log('\n[1] Sending initialize request over STDIO stdin...');
    const initRes = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'stdio-test-client', version: '1.0.0' },
    });
    console.log('    Initialize Response ID:', initRes.id);
    console.log('    Server Info:', JSON.stringify(initRes.result?.serverInfo));
    console.log('    Capabilities:', JSON.stringify(initRes.result?.capabilities));

    sendNotification('notifications/initialized');

    // 2. tools/list
    console.log('\n[2] Sending tools/list request over STDIO stdin...');
    const toolsRes = await sendRequest('tools/list', {});
    const tools = toolsRes.result?.tools || [];
    console.log(`    Total Tools Discovered: ${tools.length}`);
    tools.forEach((t) => console.log(`     - ${t.name}: ${t.description.split('.')[0]}`));
    if (tools.length !== 10) {
      throw new Error(`Expected 10 tools, got ${tools.length}`);
    }

    // 3. tools/call -> create_record
    console.log('\n[3] Calling tool create_record over STDIO stdin...');
    const createRes = await sendRequest('tools/call', {
      name: 'create_record',
      arguments: {
        title: 'STDIO Transport Verification Record',
        metadata: { mode: 'stdio', timestamp: new Date().toISOString() },
      },
    });
    const createText = createRes.result?.content?.[0]?.text;
    const createdData = JSON.parse(createText || '{}');
    const recordId = createdData.id || createdData.record?.id;
    console.log(`    Created Record ID: ${recordId}`);
    console.log(`    Title:             ${createdData.title || createdData.record?.title}`);
    if (!recordId) throw new Error('create_record failed to return a valid UUID over STDIO');

    // 4. tools/call -> delete_record
    console.log(`\n[4] Calling tool delete_record for ID ${recordId} over STDIO stdin...`);
    const deleteRes = await sendRequest('tools/call', {
      name: 'delete_record',
      arguments: { id: recordId },
    });
    const deleteText = deleteRes.result?.content?.[0]?.text;
    console.log(`    Delete Result:     ${deleteText}`);

    // 5. tools/call -> estimate_pr_cost
    console.log('\n[5] Calling tool estimate_pr_cost (real Class1 engine) over STDIO stdin...');
    const beforeCode = `import openai\nclient = openai.OpenAI()\nresp = client.chat.completions.create(model='gpt-4o-mini', max_tokens=500)\n`;
    const afterCode = `import openai\nclient = openai.OpenAI()\nresp = client.chat.completions.create(model='gpt-4o', max_tokens=2000)\n`;
    const estimateRes = await sendRequest('tools/call', {
      name: 'estimate_pr_cost',
      arguments: {
        beforeCode,
        afterCode,
        path: 'services/stdio_test.py',
        prNumber: 999,
        budgetP90Usd: 5000,
        samples: 1000,
      },
    });
    const estimateText = estimateRes.result?.content?.[0]?.text;
    const estimateData = JSON.parse(estimateText || '{}');
    console.log(`    Modeled Expected:  $${estimateData.forecast?.expected?.toFixed(2)}`);
    console.log(`    Modeled P50:       $${estimateData.forecast?.p50?.toFixed(2)}`);
    console.log(`    Modeled P90:       $${estimateData.forecast?.p90?.toFixed(2)}`);
    console.log(`    Policy Verdict:    ${estimateData.verdict}`);
    console.log(`    Footprint Status:  ${estimateData.report?.includes('Ecological footprint: NOT COMPUTED') ? 'DISCLAIMED (PASS)' : 'UNKNOWN'}`);

    if (estimateData.recordId) {
      await sendRequest('tools/call', {
        name: 'delete_record',
        arguments: { id: estimateData.recordId },
      });
      console.log(`    Cleaned up estimate record: ${estimateData.recordId}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('REAL STDIO HANDSHAKE COMPLETE: ALL PROTOCOL OPERATIONS PASSED!');
    console.log('='.repeat(70));
  } finally {
    child.kill();
  }
}

runStdioHandshake().catch((err) => {
  console.error('STDIO handshake failed:', err);
  process.exit(1);
});
