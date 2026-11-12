import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './index.js';
import { config } from '../config.js';

export const SEED_USER_ID = config.DEFAULT_USER_ID;
export const SEED_RECORD_1_ID = '00000000-0000-0000-0000-000000000010';
export const SEED_RECORD_2_ID = '00000000-0000-0000-0000-000000000020';
export const SEED_AUDIT_LOG_ID = '00000000-0000-0000-0000-000000000099';

export async function seedDatabase() {
  console.log('🌱 Seeding Neon PostgreSQL with Class1Dev baseline records (idempotent)...');
  const client = await pool.connect();
  try {
    // 1. Upsert Class1Dev users (Lead & Engineering Team)
    const userRes = await client.query(`
      INSERT INTO users (id, name, email)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, email;
    `, [SEED_USER_ID, 'Class1Dev Software Engineering Team', 'engineers@class1dev.ai']);

    const userId = userRes.rows[0].id;
    console.log(`👤 Active User configured: ${userRes.rows[0].name} (${userId})`);

    // Clean up any earlier non-idempotent sample rows with same titles
    await client.query(`
      DELETE FROM records
      WHERE user_id = $1 
        AND id NOT IN ($2, $3)
        AND title IN (
          'PR #42: Model Migration & Retry Loop Cost Risk Evaluation',
          'Class1 Benchmark: Cost Per Completed Task (SWE-Bench)'
        );
    `, [userId, SEED_RECORD_1_ID, SEED_RECORD_2_ID]);

    // 2. Upsert Class1Dev cost governance record
    const realReportText = [
      'ABC7D  ·  AI cost-risk report  ·  Impact: HIGH',
      '',
      'Estimate class: Class 5 (Screening)',
      '  Accuracy range: -50% / +100%',
      '  Basis: assumed risk factors, UNCALIBRATED (0 actuals)',
      '',
      'This PR changes:',
      '- openai.chat.completions.create: model gpt-4o-mini -> gpt-4o',
      '- openai.chat.completions.create: max_tokens 500 -> 2000',
      '',
      'Modeled risk band (Monte Carlo, paired) -- conditional on the inputs:',
      '  Expected   +$3,135 / mo',
      '  P50        +$1,963 / mo',
      '  P90        +$6,403 / mo   <- contingency',
      '  P95        +$9,414 / mo',
      '  Worst      +$25,820 / mo',
      '',
      'Estimate maturity band (Class 5) -- how wrong the inputs may be:',
      '  Expected delta could land between +$1,567 and +$6,270 / mo',
      '',
      'Main tail-risk drivers (ranked):',
      '  1. output length',
      '  2. retry loop',
      '  3. demand spike',
      '  4. context growth',
      '',
      '12-month escalation (decomposed -- NOT inflation):',
      '  Unit price:  x0.94  (deflationary)',
      '  Volume:      x3.00  (usage growth)',
      '  Structure:   x1.50  (tokens/call drift)',
      '  NET:         x4.24  ->  attack \'volume\'',
      '',
      'Escalated delta (expected | P90):',
      '  Year 0:  +$3,135  |  +$6,403  / mo',
      '  Year 1:  +$13,306  |  +$27,179  / mo',
      '  Year 2:  +$56,479  |  +$115,363  / mo',
      '',
      'Recommendation: \'gpt-4o\' is suboptimal (meets the spec but isn\'t the cheapest). Switching to \'kimi-k2-0905-preview\' saves ~$888/mo.',
      '',
      'Basis of Estimate',
      '  Included:',
      '    + LLM token cost — flat per-token',
      '  Excluded (declared, not silently dropped):',
      '    - service / flex tiers (priority or flex pricing)',
      '    - multimodal token rates (audio / image billed separately)',
      '    - search-grounding surcharges (per-query web search)',
      '    - egress / data transfer',
      '    - GPU / self-hosted inference / fine-tune training',
      '    - embedding / vector-store retrieval',
      '    - agent-loop orchestration compute',
      '    - vector-DB hosting / observability tooling (fixed monthly)',
      '    - MCP/tool-definition input overhead (set tool_overhead_tokens if the agent loads tools)',
      '    - cloud infra (compute / vector-DB / storage / egress) — set Scenario.cloud',
      '  Price basis: frozen snapshot, ~159 days old (reproducible; ages via estimate_decay).',
      '  Evidence: hypothesis (0 estimate↔actual pair(s) so far).',
      '',
      'Ecological footprint: NOT COMPUTED (cost_engine.footprint is missing from class1 0.1.0)',
    ].join('\n');

    await client.query(`
      INSERT INTO records (id, user_id, title, description, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `, [
      SEED_RECORD_1_ID,
      userId,
      'PR #42: app.py OpenAI Model Migration Cost Risk Evaluation',
      'Class1 Pre-Merge Cost Governance Evaluation: Changes model from gpt-4o-mini to gpt-4o and max_tokens from 500 to 2000. Modeled P90 tail risk: $6403.19/mo. Verdict: WARN.',
      JSON.stringify({
        type: 'cost_estimate',
        project: 'class1dev',
        prNumber: 42,
        path: 'app.py',
        budgetP90Usd: 7000.0,
        warnFraction: 0.8,
        verdict: 'WARN',
        impact: 'high',
        forecast: {
          expected: 3134.833626951535,
          p50: 1962.6150557590718,
          p80: 4202.777252143174,
          p90: 6403.191307466507,
          p95: 9414.216888209681,
          worst: 25819.97125334832,
          estimateClass: 'Class 5 (Screening)',
        },
        delta: {
          expected: 3134.833626951535,
          p50: 1962.6150557590718,
          p80: 4202.777252143174,
          p90: 6403.191307466507,
          p95: 9414.216888209681,
          worst: 25819.97125334832,
        },
        reportText: realReportText,
        samples: 10000,
      }),
    ]);

    // 3. Upsert model comparison benchmark record
    await client.query(`
      INSERT INTO records (id, user_id, title, description, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `, [
      SEED_RECORD_2_ID,
      userId,
      'Class1 Benchmark: Cost Per Completed Task (SWE-Bench)',
      'Evaluation of true cost per completed task incorporating benchmark accuracy and retry penalties.',
      JSON.stringify({
        project: 'class1dev',
        domain: 'coding',
        rankedModels: [
          { model: 'o3-mini', costPerCompletedTaskUsd: 0.0088, sweBenchScore: 0.79 },
          { model: 'gpt-4o-mini', costPerCompletedTaskUsd: 0.0125, sweBenchScore: 0.54 },
          { model: 'claude-3-5-sonnet', costPerCompletedTaskUsd: 0.0240, sweBenchScore: 0.77 },
        ],
      }),
    ]);

    // 4. Upsert audit log
    await client.query(`
      INSERT INTO audit_logs (id, user_id, tool_name, action, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        action = EXCLUDED.action,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata;
    `, [
      SEED_AUDIT_LOG_ID,
      userId,
      'seed_database',
      'INITIALIZE',
      'SUCCESS',
      JSON.stringify({ client: 'class1dev', note: 'Initialized Class1Dev baseline cost governance records' }),
    ]);

    console.log('✅ Class1Dev seeding complete. Ready for MCP tool calls.');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Robust cross-platform CLI entrypoint check (handles Windows drive letters, slashes, and paths with spaces)
const isMain = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` ||
  path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
);

if (isMain) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
