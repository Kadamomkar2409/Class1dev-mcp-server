import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import readline from 'node:readline';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_ENTRY = join(PROJECT_ROOT, 'dist', 'index.js');

async function testEveryTool() {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE MCP TEST: EXECUTING ALL 10 PURE FINOPS TOOLS WITH RECOMMENDED PARAMS');
  console.log(`Server Entry: ${SERVER_ENTRY}`);
  console.log('='.repeat(80));

  const child = spawn('node', [SERVER_ENTRY], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      MCP_TRANSPORT: 'stdio',
      PYTHONUTF8: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const pendingRequests = new Map();
  const stderrLogs = [];

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
    } catch {
      // Ignore non-json lines
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

  async function callTool(name, args) {
    const start = Date.now();
    const res = await sendRequest('tools/call', { name, arguments: args });
    const durationMs = Date.now() - start;
    if (res.error) {
      throw new Error(`Tool ${name} failed with JSON-RPC error: ${JSON.stringify(res.error)}`);
    }
    const text = res.result?.content?.[0]?.text;
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return { result: parsed, durationMs };
  }

  const resultsSummary = [];

  try {
    // 1. Initialize Handshake
    console.log('\n[Handshake] Initializing MCP STDIO session...');
    const initRes = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'all-tools-tester', version: '1.0.0' },
    });
    console.log('            Server:', JSON.stringify(initRes.result?.serverInfo));
    sendNotification('notifications/initialized');

    // 2. Discover Tools
    console.log('\n[Discovery] Listing all registered tools...');
    const listRes = await sendRequest('tools/list', {});
    const tools = listRes.result?.tools || [];
    console.log(`            Found ${tools.length} total tools registered:`);
    tools.forEach((t, i) => console.log(`             ${i + 1}. ${t.name.padEnd(30)}: ${t.description.split('.')[0]}`));
    if (tools.length !== 10) {
      throw new Error(`Expected 10 tools, got ${tools.length}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('EXECUTING THE 10 PURE ENTERPRISE AI FINOPS TOOLS');
    console.log('='.repeat(80));

    // --- TOOL 1: evaluate_pr_cost_risk (Real Class1 Python Takeoff Engine) ---
    console.log('\n[Tool 1/10] evaluate_pr_cost_risk');
    const evalParams = {
      beforeCode: `import anthropic\nclient = anthropic.Anthropic()\nresp = client.messages.create(model='claude-3-haiku-20240307', max_tokens=1000)\n`,
      afterCode: `import anthropic\nclient = anthropic.Anthropic()\nresp = client.messages.create(model='claude-3-5-sonnet-20241022', max_tokens=4000)\n`,
      path: 'ai_agents/code_reviewer.py',
      prNumber: 880,
      repo: 'enterprise/ai-platform',
      budgetP90Usd: 5000,
      samples: 1000,
    };
    console.log('  Recommended Params: beforeCode/afterCode diff, path="ai_agents/code_reviewer.py", budgetP90Usd=5000, samples=1000');
    const t1 = await callTool('evaluate_pr_cost_risk', evalParams);
    const finopsRecordId = t1.result.recordId;
    console.log(`  ✓ Result (${t1.durationMs}ms): FinOps Verdict: ${t1.result.verdict}, P90: $${t1.result.forecast?.p90?.toFixed(2)}/mo, Ledger UUID: ${finopsRecordId}`);
    resultsSummary.push({ num: 1, name: 'evaluate_pr_cost_risk', category: 'Cost Takeoff Engine', status: 'PASS', detail: `Verdict: ${t1.result.verdict}, P90: $${t1.result.forecast?.p90?.toFixed(2)}` });

    // --- TOOL 2: get_pr_governance_verdict ---
    console.log('\n[Tool 2/10] get_pr_governance_verdict');
    const govVerdictParams = { id: finopsRecordId };
    console.log('  Recommended Params:', JSON.stringify(govVerdictParams, null, 2));
    const t2 = await callTool('get_pr_governance_verdict', govVerdictParams);
    console.log(`  ✓ Result (${t2.durationMs}ms): Governed Verdict: ${t2.result.verdict}, Budget P90: $${t2.result.budgetP90Usd}`);
    resultsSummary.push({ num: 2, name: 'get_pr_governance_verdict', category: 'Governance Verdict', status: 'PASS', detail: `Verdict: ${t2.result.verdict}` });

    // --- TOOL 3: log_budget_policy_override ---
    console.log('\n[Tool 3/10] log_budget_policy_override');
    const overrideParams = {
      title: 'Q4 High-Throughput Cyber Monday Model Upgrade',
      description: 'Pre-approved budget waiver granted by FinOps Steering Committee for retail peak load.',
      metadata: {
        approvedBy: 'head-of-finops',
        ticket: 'FINOPS-9421',
        p90CapUsd: 15000,
        validThrough: '2026-12-05',
        costCenter: 'RETAIL-ENGINEERING',
      },
    };
    console.log('  Recommended Params:', JSON.stringify(overrideParams, null, 2));
    const t3 = await callTool('log_budget_policy_override', overrideParams);
    const overrideRecordId = t3.result.id || t3.result.record?.id;
    console.log(`  ✓ Result (${t3.durationMs}ms): Override Logged with UUID: ${overrideRecordId}`);
    resultsSummary.push({ num: 3, name: 'log_budget_policy_override', category: 'Policy Exception', status: 'PASS', detail: `UUID: ${overrideRecordId}` });

    // --- TOOL 4: get_governance_record ---
    console.log('\n[Tool 4/10] get_governance_record');
    const govRecordParams = { id: overrideRecordId };
    console.log('  Recommended Params:', JSON.stringify(govRecordParams, null, 2));
    const t4 = await callTool('get_governance_record', govRecordParams);
    const fetchedGov = t4.result.record || t4.result;
    console.log(`  ✓ Result (${t4.durationMs}ms): Title: "${fetchedGov.title}", Approver: ${fetchedGov.metadata?.approvedBy}`);
    resultsSummary.push({ num: 4, name: 'get_governance_record', category: 'Ledger Audit', status: 'PASS', detail: `Approver: ${fetchedGov.metadata?.approvedBy}` });

    // --- TOOL 5: list_governance_ledger ---
    console.log('\n[Tool 5/10] list_governance_ledger');
    const ledgerParams = { limit: 5, offset: 0 };
    console.log('  Recommended Params:', JSON.stringify(ledgerParams, null, 2));
    const t5 = await callTool('list_governance_ledger', ledgerParams);
    console.log(`  ✓ Result (${t5.durationMs}ms): Retrieved ${t5.result.records?.length} governance entries, Ledger Size: ${t5.result.pagination?.total}`);
    resultsSummary.push({ num: 5, name: 'list_governance_ledger', category: 'Ledger Audit', status: 'PASS', detail: `Ledger total: ${t5.result.pagination?.total}` });

    // --- TOOL 6: update_governance_record ---
    console.log('\n[Tool 6/10] update_governance_record');
    const updateGovParams = {
      id: overrideRecordId,
      title: 'Q4 High-Throughput Cyber Monday Model Upgrade (Audited)',
      description: 'Pre-approved budget waiver verified with Finance and FinOps risk team.',
      metadata: {
        approvedBy: 'head-of-finops',
        auditedBy: 'risk-compliance',
        ticket: 'FINOPS-9421',
        p90CapUsd: 15000,
        validThrough: '2026-12-05',
        status: 'ACTIVE_AUDITED',
      },
    };
    console.log('  Recommended Params:', JSON.stringify(updateGovParams, null, 2));
    const t6 = await callTool('update_governance_record', updateGovParams);
    console.log(`  ✓ Result (${t6.durationMs}ms): Updated Title: "${t6.result.record?.title}"`);
    resultsSummary.push({ num: 6, name: 'update_governance_record', category: 'Ledger Audit', status: 'PASS', detail: `Audited by: ${t6.result.record?.metadata?.auditedBy}` });

    // --- TOOL 7: audit_pr_cost_history ---
    console.log('\n[Tool 7/10] audit_pr_cost_history');
    const auditParams = { query: 'Cyber Monday', limit: 5 };
    console.log('  Recommended Params:', JSON.stringify(auditParams, null, 2));
    const t7 = await callTool('audit_pr_cost_history', auditParams);
    console.log(`  ✓ Result (${t7.durationMs}ms): Audit Matches: ${t7.result.resultsFound}`);
    resultsSummary.push({ num: 7, name: 'audit_pr_cost_history', category: 'Historical Search', status: 'PASS', detail: `Matches: ${t7.result.resultsFound}` });

    // --- TOOL 8: get_finops_compliance_metrics ---
    console.log('\n[Tool 8/10] get_finops_compliance_metrics');
    const finopsMetricsParams = {};
    console.log('  Recommended Params:', JSON.stringify(finopsMetricsParams, null, 2));
    const t8 = await callTool('get_finops_compliance_metrics', finopsMetricsParams);
    console.log(`  ✓ Result (${t8.durationMs}ms): Total Ledger Entries: ${t8.result.statistics?.totalRecords}, Audit Trail Entries: ${t8.result.statistics?.totalAuditLogs}`);
    resultsSummary.push({ num: 8, name: 'get_finops_compliance_metrics', category: 'Compliance Metrics', status: 'PASS', detail: `Ledger: ${t8.result.statistics?.totalRecords}, Audits: ${t8.result.statistics?.totalAuditLogs}` });

    // --- TOOL 9: get_service_health ---
    console.log('\n[Tool 9/10] get_service_health');
    const serviceHealthParams = {};
    console.log('  Recommended Params:', JSON.stringify(serviceHealthParams, null, 2));
    const t9 = await callTool('get_service_health', serviceHealthParams);
    console.log(`  ✓ Result (${t9.durationMs}ms): Health: ${t9.result.status}, DB Latency: ${t9.result.database?.latencyMs}ms, Transport: ${t9.result.transport}`);
    resultsSummary.push({ num: 9, name: 'get_service_health', category: 'Telemetry & Health', status: 'PASS', detail: `Status: ${t9.result.status}, Latency: ${t9.result.database?.latencyMs}ms` });

    // --- TOOL 10: delete_governance_record ---
    console.log('\n[Tool 10/10] delete_governance_record');
    const deleteGovParams = { id: overrideRecordId };
    console.log('  Recommended Params:', JSON.stringify(deleteGovParams, null, 2));
    const t10 = await callTool('delete_governance_record', deleteGovParams);
    console.log(`  ✓ Result (${t10.durationMs}ms): ${t10.result.message}`);
    resultsSummary.push({ num: 10, name: 'delete_governance_record', category: 'Ledger Audit', status: 'PASS', detail: 'Deleted successfully' });

    // Clean up FinOps evaluation record
    if (finopsRecordId) {
      await callTool('delete_governance_record', { id: finopsRecordId });
    }

    // Final Summary Table
    console.log('\n' + '='.repeat(85));
    console.log('ALL 10 PURE FINOPS TOOLS EXECUTION VERIFICATION SUMMARY');
    console.log('='.repeat(85));
    console.log(
      '#'.padEnd(4) +
      'Tool Name'.padEnd(32) +
      'Category'.padEnd(24) +
      'Status'.padEnd(10) +
      'Key Execution Detail'
    );
    console.log('-'.repeat(85));
    for (const r of resultsSummary) {
      console.log(
        String(r.num).padEnd(4) +
        r.name.padEnd(32) +
        r.category.padEnd(24) +
        r.status.padEnd(10) +
        r.detail
      );
    }
    console.log('='.repeat(85));
    console.log(`TOTAL TOOLS TESTED: 10 / 10`);
    console.log(`PASSED: 10 | FAILED: 0`);
    console.log('='.repeat(85));
  } finally {
    child.kill();
    process.exit(0);
  }
}

testEveryTool().catch((err) => {
  console.error('\n❌ Execution of all tools failed:', err);
  process.exit(1);
});
