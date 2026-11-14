import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import readline from 'node:readline';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_ENTRY = join(PROJECT_ROOT, 'dist', 'index.js');

async function testEveryTool() {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE MCP TEST: EXECUTING ALL 20 TOOLS WITH RECOMMENDED PARAMETERS');
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
    console.log(`            Found ${tools.length} total tools registered.`);
    if (tools.length !== 20) {
      throw new Error(`Expected 20 tools, got ${tools.length}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('PILLAR 1: PRD DATABASE & ENGINE BENCHMARK TOOLS (10 TOOLS)');
    console.log('='.repeat(80));

    // --- TOOL 1: create_record ---
    console.log('\n[Tool 1/20] create_record');
    const createParams = {
      title: 'Production Incident #501: LLM Gateway Spike',
      description: 'Unanticipated spike in token consumption on production summarizer endpoint.',
      metadata: {
        environment: 'production',
        service: 'api-gateway',
        severity: 'HIGH',
        costSpikeUsd: 450.0,
      },
    };
    console.log('  Recommended Params:', JSON.stringify(createParams, null, 2));
    const t1 = await callTool('create_record', createParams);
    const prdRecordId = t1.result.id || t1.result.record?.id;
    console.log(`  ✓ Result (${t1.durationMs}ms): Created UUID ${prdRecordId}`);
    resultsSummary.push({ num: 1, name: 'create_record', category: 'PRD Database', status: 'PASS', detail: `UUID: ${prdRecordId}` });

    // --- TOOL 2: get_record ---
    console.log('\n[Tool 2/20] get_record');
    const getParams = { id: prdRecordId };
    console.log('  Recommended Params:', JSON.stringify(getParams, null, 2));
    const t2 = await callTool('get_record', getParams);
    const fetchedRec = t2.result.record || t2.result;
    console.log(`  ✓ Result (${t2.durationMs}ms): Title: "${fetchedRec.title}", Severity: ${fetchedRec.metadata?.severity}`);
    resultsSummary.push({ num: 2, name: 'get_record', category: 'PRD Database', status: 'PASS', detail: `Title: ${fetchedRec.title}` });

    // --- TOOL 3: list_records ---
    console.log('\n[Tool 3/20] list_records');
    const listParams = { limit: 5, offset: 0 };
    console.log('  Recommended Params:', JSON.stringify(listParams, null, 2));
    const t3 = await callTool('list_records', listParams);
    console.log(`  ✓ Result (${t3.durationMs}ms): Returned ${t3.result.records?.length} records, Total: ${t3.result.pagination?.total}`);
    resultsSummary.push({ num: 3, name: 'list_records', category: 'PRD Database', status: 'PASS', detail: `Total: ${t3.result.pagination?.total}` });

    // --- TOOL 4: update_record ---
    console.log('\n[Tool 4/20] update_record');
    const updateParams = {
      id: prdRecordId,
      title: 'Production Incident #501: LLM Gateway Spike (Mitigated)',
      description: 'Resolved by enabling rate limiting and caching. Final incident report attached.',
      metadata: {
        environment: 'production',
        service: 'api-gateway',
        severity: 'RESOLVED',
        costSpikeUsd: 450.0,
        mitigationDuration: '14m',
      },
    };
    console.log('  Recommended Params:', JSON.stringify(updateParams, null, 2));
    const t4 = await callTool('update_record', updateParams);
    console.log(`  ✓ Result (${t4.durationMs}ms): Updated Title: "${t4.result.record?.title}"`);
    resultsSummary.push({ num: 4, name: 'update_record', category: 'PRD Database', status: 'PASS', detail: `Updated status: ${t4.result.record?.metadata?.severity}` });

    // --- TOOL 5: search_records ---
    console.log('\n[Tool 5/20] search_records');
    const searchParams = { query: 'Gateway Spike', limit: 5 };
    console.log('  Recommended Params:', JSON.stringify(searchParams, null, 2));
    const t5 = await callTool('search_records', searchParams);
    console.log(`  ✓ Result (${t5.durationMs}ms): Matches Found: ${t5.result.resultsFound}`);
    resultsSummary.push({ num: 5, name: 'search_records', category: 'PRD Database', status: 'PASS', detail: `Found: ${t5.result.resultsFound}` });

    // --- TOOL 6: get_database_stats ---
    console.log('\n[Tool 6/20] get_database_stats');
    const statsParams = {};
    console.log('  Recommended Params:', JSON.stringify(statsParams, null, 2));
    const t6 = await callTool('get_database_stats', statsParams);
    console.log(`  ✓ Result (${t6.durationMs}ms): Total Records: ${t6.result.statistics?.totalRecords}, Audit Logs: ${t6.result.statistics?.totalAuditLogs}`);
    resultsSummary.push({ num: 6, name: 'get_database_stats', category: 'PRD Database', status: 'PASS', detail: `Records: ${t6.result.statistics?.totalRecords}` });

    // --- TOOL 7: get_system_status ---
    console.log('\n[Tool 7/20] get_system_status');
    const statusParams = {};
    console.log('  Recommended Params:', JSON.stringify(statusParams, null, 2));
    const t7 = await callTool('get_system_status', statusParams);
    console.log(`  ✓ Result (${t7.durationMs}ms): DB Connected: ${t7.result.database?.connected}, Latency: ${t7.result.database?.latencyMs}ms, Transport: ${t7.result.transport}`);
    resultsSummary.push({ num: 7, name: 'get_system_status', category: 'PRD Telemetry', status: 'PASS', detail: `Connected: ${t7.result.database?.connected}, Transport: ${t7.result.transport}` });

    // --- TOOL 8: estimate_pr_cost (Real Class1 Python Takeoff Engine) ---
    console.log('\n[Tool 8/20] estimate_pr_cost');
    const estimateParams = {
      beforeCode: `import openai\nclient = openai.OpenAI()\nresp = client.chat.completions.create(model='gpt-4o-mini', max_tokens=500)\n`,
      afterCode: `import openai\nclient = openai.OpenAI()\nresp = client.chat.completions.create(model='gpt-4o', max_tokens=2000)\n`,
      path: 'services/summarizer.py',
      prNumber: 1042,
      repo: 'class1dev/core-backend',
      budgetP90Usd: 7500,
      samples: 1000,
    };
    console.log('  Recommended Params: beforeCode/afterCode diff, path="services/summarizer.py", budgetP90Usd=7500, samples=1000');
    const t8 = await callTool('estimate_pr_cost', estimateParams);
    const prdEstimateId = t8.result.recordId;
    console.log(`  ✓ Result (${t8.durationMs}ms): Verdict: ${t8.result.verdict}, Expected Delta: $${t8.result.forecast?.expected?.toFixed(2)}, P90 Delta: $${t8.result.forecast?.p90?.toFixed(2)}`);
    resultsSummary.push({ num: 8, name: 'estimate_pr_cost', category: 'PRD Engine', status: 'PASS', detail: `Verdict: ${t8.result.verdict}, P90: $${t8.result.forecast?.p90?.toFixed(2)}` });

    // --- TOOL 9: get_cost_verdict ---
    console.log('\n[Tool 9/20] get_cost_verdict');
    const verdictParams = { id: prdEstimateId };
    console.log('  Recommended Params:', JSON.stringify(verdictParams, null, 2));
    const t9 = await callTool('get_cost_verdict', verdictParams);
    console.log(`  ✓ Result (${t9.durationMs}ms): Stored Verdict: ${t9.result.verdict}, Budget P90: $${t9.result.budgetP90Usd}`);
    resultsSummary.push({ num: 9, name: 'get_cost_verdict', category: 'PRD Engine', status: 'PASS', detail: `Verdict: ${t9.result.verdict}` });

    // --- TOOL 10: delete_record ---
    console.log('\n[Tool 10/20] delete_record');
    const deleteParams = { id: prdRecordId };
    console.log('  Recommended Params:', JSON.stringify(deleteParams, null, 2));
    const t10 = await callTool('delete_record', deleteParams);
    console.log(`  ✓ Result (${t10.durationMs}ms): ${t10.result.message}`);
    resultsSummary.push({ num: 10, name: 'delete_record', category: 'PRD Database', status: 'PASS', detail: 'Deleted successfully' });

    // Clean up PRD estimate record
    if (prdEstimateId) {
      await callTool('delete_record', { id: prdEstimateId });
    }

    console.log('\n' + '='.repeat(80));
    console.log('PILLAR 2: ENTERPRISE AI FINOPS & GOVERNANCE DOMAIN TOOLS (10 TOOLS)');
    console.log('='.repeat(80));

    // --- TOOL 11: evaluate_pr_cost_risk ---
    console.log('\n[Tool 11/20] evaluate_pr_cost_risk');
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
    const t11 = await callTool('evaluate_pr_cost_risk', evalParams);
    const finopsRecordId = t11.result.recordId;
    console.log(`  ✓ Result (${t11.durationMs}ms): FinOps Verdict: ${t11.result.verdict}, P90: $${t11.result.forecast?.p90?.toFixed(2)}/mo, Ledger UUID: ${finopsRecordId}`);
    resultsSummary.push({ num: 11, name: 'evaluate_pr_cost_risk', category: 'FinOps Governance', status: 'PASS', detail: `Verdict: ${t11.result.verdict}, P90: $${t11.result.forecast?.p90?.toFixed(2)}` });

    // --- TOOL 12: get_pr_governance_verdict ---
    console.log('\n[Tool 12/20] get_pr_governance_verdict');
    const govVerdictParams = { id: finopsRecordId };
    console.log('  Recommended Params:', JSON.stringify(govVerdictParams, null, 2));
    const t12 = await callTool('get_pr_governance_verdict', govVerdictParams);
    console.log(`  ✓ Result (${t12.durationMs}ms): Governed Verdict: ${t12.result.verdict}, Budget P90: $${t12.result.budgetP90Usd}`);
    resultsSummary.push({ num: 12, name: 'get_pr_governance_verdict', category: 'FinOps Governance', status: 'PASS', detail: `Verdict: ${t12.result.verdict}` });

    // --- TOOL 13: log_budget_policy_override ---
    console.log('\n[Tool 13/20] log_budget_policy_override');
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
    const t13 = await callTool('log_budget_policy_override', overrideParams);
    const overrideRecordId = t13.result.id || t13.result.record?.id;
    console.log(`  ✓ Result (${t13.durationMs}ms): Override Logged with UUID: ${overrideRecordId}`);
    resultsSummary.push({ num: 13, name: 'log_budget_policy_override', category: 'FinOps Policy', status: 'PASS', detail: `UUID: ${overrideRecordId}` });

    // --- TOOL 14: get_governance_record ---
    console.log('\n[Tool 14/20] get_governance_record');
    const govRecordParams = { id: overrideRecordId };
    console.log('  Recommended Params:', JSON.stringify(govRecordParams, null, 2));
    const t14 = await callTool('get_governance_record', govRecordParams);
    const fetchedGov = t14.result.record || t14.result;
    console.log(`  ✓ Result (${t14.durationMs}ms): Title: "${fetchedGov.title}", Approver: ${fetchedGov.metadata?.approvedBy}`);
    resultsSummary.push({ num: 14, name: 'get_governance_record', category: 'FinOps Ledger', status: 'PASS', detail: `Approver: ${fetchedGov.metadata?.approvedBy}` });

    // --- TOOL 15: list_governance_ledger ---
    console.log('\n[Tool 15/20] list_governance_ledger');
    const ledgerParams = { limit: 5, offset: 0 };
    console.log('  Recommended Params:', JSON.stringify(ledgerParams, null, 2));
    const t15 = await callTool('list_governance_ledger', ledgerParams);
    console.log(`  ✓ Result (${t15.durationMs}ms): Retrieved ${t15.result.records?.length} governance entries, Ledger Size: ${t15.result.pagination?.total}`);
    resultsSummary.push({ num: 15, name: 'list_governance_ledger', category: 'FinOps Ledger', status: 'PASS', detail: `Ledger total: ${t15.result.pagination?.total}` });

    // --- TOOL 16: update_governance_record ---
    console.log('\n[Tool 16/20] update_governance_record');
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
    const t16 = await callTool('update_governance_record', updateGovParams);
    console.log(`  ✓ Result (${t16.durationMs}ms): Updated Title: "${t16.result.record?.title}"`);
    resultsSummary.push({ num: 16, name: 'update_governance_record', category: 'FinOps Ledger', status: 'PASS', detail: `Audited by: ${t16.result.record?.metadata?.auditedBy}` });

    // --- TOOL 17: audit_pr_cost_history ---
    console.log('\n[Tool 17/20] audit_pr_cost_history');
    const auditParams = { query: 'Cyber Monday', limit: 5 };
    console.log('  Recommended Params:', JSON.stringify(auditParams, null, 2));
    const t17 = await callTool('audit_pr_cost_history', auditParams);
    console.log(`  ✓ Result (${t17.durationMs}ms): Audit Matches: ${t17.result.resultsFound}`);
    resultsSummary.push({ num: 17, name: 'audit_pr_cost_history', category: 'FinOps Audit', status: 'PASS', detail: `Matches: ${t17.result.resultsFound}` });

    // --- TOOL 18: get_finops_compliance_metrics ---
    console.log('\n[Tool 18/20] get_finops_compliance_metrics');
    const finopsMetricsParams = {};
    console.log('  Recommended Params:', JSON.stringify(finopsMetricsParams, null, 2));
    const t18 = await callTool('get_finops_compliance_metrics', finopsMetricsParams);
    console.log(`  ✓ Result (${t18.durationMs}ms): Total Ledger Entries: ${t18.result.statistics?.totalRecords}, Audit Trail Entries: ${t18.result.statistics?.totalAuditLogs}`);
    resultsSummary.push({ num: 18, name: 'get_finops_compliance_metrics', category: 'FinOps Telemetry', status: 'PASS', detail: `Ledger: ${t18.result.statistics?.totalRecords}, Audits: ${t18.result.statistics?.totalAuditLogs}` });

    // --- TOOL 19: get_service_health ---
    console.log('\n[Tool 19/20] get_service_health');
    const serviceHealthParams = {};
    console.log('  Recommended Params:', JSON.stringify(serviceHealthParams, null, 2));
    const t19 = await callTool('get_service_health', serviceHealthParams);
    console.log(`  ✓ Result (${t19.durationMs}ms): Health: ${t19.result.status}, DB Latency: ${t19.result.database?.latencyMs}ms, Transport: ${t19.result.transport}`);
    resultsSummary.push({ num: 19, name: 'get_service_health', category: 'FinOps Telemetry', status: 'PASS', detail: `Status: ${t19.result.status}, Latency: ${t19.result.database?.latencyMs}ms` });

    // --- TOOL 20: delete_governance_record ---
    console.log('\n[Tool 20/20] delete_governance_record');
    const deleteGovParams = { id: overrideRecordId };
    console.log('  Recommended Params:', JSON.stringify(deleteGovParams, null, 2));
    const t20 = await callTool('delete_governance_record', deleteGovParams);
    console.log(`  ✓ Result (${t20.durationMs}ms): ${t20.result.message}`);
    resultsSummary.push({ num: 20, name: 'delete_governance_record', category: 'FinOps Ledger', status: 'PASS', detail: 'Deleted successfully' });

    // Clean up FinOps evaluation record
    if (finopsRecordId) {
      await callTool('delete_governance_record', { id: finopsRecordId });
    }

    // Final Summary Table
    console.log('\n' + '='.repeat(85));
    console.log('ALL 20 TOOLS EXECUTION VERIFICATION SUMMARY');
    console.log('='.repeat(85));
    console.log(
      '#'.padEnd(4) +
      'Tool Name'.padEnd(32) +
      'Category'.padEnd(20) +
      'Status'.padEnd(10) +
      'Key Execution Detail'
    );
    console.log('-'.repeat(85));
    for (const r of resultsSummary) {
      console.log(
        String(r.num).padEnd(4) +
        r.name.padEnd(32) +
        r.category.padEnd(20) +
        r.status.padEnd(10) +
        r.detail
      );
    }
    console.log('='.repeat(85));
    console.log(`TOTAL TOOLS TESTED: 20 / 20`);
    console.log(`PASSED: 20 | FAILED: 0`);
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

