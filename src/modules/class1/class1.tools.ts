import { ToolDecorator as Tool, ExecutionContext, Injectable } from '@nitrostack/core';
import { RecordService } from '../../services/record.service.js';
import { HealthService } from '../../services/health.service.js';
import { Class1EngineService } from '../../services/class1-engine.service.js';
import { formatToolError, sanitizeErrorMessage } from '../../utils/error-handler.js';
import {
  EvaluatePrCostRiskSchema,
  GetPrGovernanceVerdictSchema,
  LogBudgetPolicyOverrideSchema,
  GetGovernanceRecordSchema,
  ListGovernanceLedgerSchema,
  UpdateGovernanceRecordSchema,
  DeleteGovernanceRecordSchema,
  AuditPrCostHistorySchema,
  GetFinopsComplianceMetricsSchema,
  GetServiceHealthSchema,
  EvaluatePrCostRiskArgs,
  GetPrGovernanceVerdictArgs,
  LogBudgetPolicyOverrideArgs,
  GetGovernanceRecordArgs,
  ListGovernanceLedgerArgs,
  UpdateGovernanceRecordArgs,
  DeleteGovernanceRecordArgs,
  AuditPrCostHistoryArgs,
  GetFinopsComplianceMetricsArgs,
  GetServiceHealthArgs,
} from '../../tools/schemas.js';

/**
 * Class1Dev Enterprise AI FinOps & Governance MCP Tools
 * Implements 10 specialized, unique tools using the NitroStack TypeScript SDK (@nitrostack/core).
 * Persists and retrieves Class1 AI cost governance records from Neon PostgreSQL with
 * sanitized error boundaries, multi-tenant safety, and real Class1 takeoff engine integration.
 */
@Injectable({ deps: [RecordService, HealthService, Class1EngineService] })
export class Class1Tools {
  constructor(
    private readonly recordService: RecordService,
    private readonly healthService: HealthService,
    private readonly class1EngineService: Class1EngineService
  ) {}

  // ============================================================================
  // 1. evaluate_pr_cost_risk (Real Class1 Takeoff Cost Engine)
  // ============================================================================
  @Tool({
    name: 'evaluate_pr_cost_risk',
    description: 'Run the real Class1 cost-risk takeoff engine on before/after code changes to estimate monthly LLM cost impact, calculate tail-risk percentiles (P50/P90/P95), and evaluate budget policy verdicts (BLOCK, WARN, PASS, or NO_BUDGET). Persists the forecast and full text report to Neon PostgreSQL.',
    inputSchema: EvaluatePrCostRiskSchema,
  })
  async evaluatePrCostRisk(args: EvaluatePrCostRiskArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing evaluate_pr_cost_risk with real Class1 engine', { path: args?.path, prNumber: args?.prNumber });
    try {
      const validated = EvaluatePrCostRiskSchema.parse(args);
      const result = await this.class1EngineService.estimate({
        beforeCode: validated.beforeCode,
        afterCode: validated.afterCode,
        path: validated.path,
        budgetP90Usd: validated.budgetP90Usd,
        samples: validated.samples,
      });

      const title = validated.prNumber
        ? `PR #${validated.prNumber}: ${validated.path} Cost Risk Evaluation`
        : `PR Cost Estimate: ${validated.path}`;

      const description = `Class1 AI cost governance estimate for ${validated.path}. Modeled P90 tail risk: $${result.forecast.p90.toFixed(2)}/mo. Verdict: ${result.verdict}.`;

      // Persist to Neon PostgreSQL
      const record = await this.recordService.createRecord({
        userId: validated.userId,
        title,
        description,
        metadata: {
          type: 'cost_estimate',
          repo: validated.repo || null,
          prNumber: validated.prNumber || null,
          path: validated.path,
          budgetP90Usd: result.budgetP90Usd,
          warnFraction: result.warnFraction,
          verdict: result.verdict,
          impact: result.impact,
          forecast: result.forecast,
          delta: result.delta,
          reportText: result.reportText,
          samples: result.samples,
        },
      });

      return {
        success: true,
        recordId: record.id,
        verdict: result.verdict,
        budgetP90Usd: result.budgetP90Usd,
        forecast: result.forecast,
        impact: result.impact,
        report: result.reportText,
      };
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      const isValidation = (err as any)?.name === 'ZodError';
      await this.recordService.logAudit({
        userId: args?.userId,
        toolName: 'evaluate_pr_cost_risk',
        action: isValidation ? 'VALIDATE' : 'ESTIMATE',
        status: isValidation ? 'VALIDATION_FAILED' : 'ENGINE_FAILURE',
        metadata: { error: safeError, path: args?.path },
      });
      return formatToolError('evaluate_pr_cost_risk', err, 'Verify before/after code and engine execution parameters.');
    }
  }

  // ============================================================================
  // 2. get_pr_governance_verdict
  // ============================================================================
  @Tool({
    name: 'get_pr_governance_verdict',
    description: 'Retrieve a stored Class1 cost-risk forecast and governance verdict (BLOCK, WARN, PASS, or NO_BUDGET) by record UUID from Neon PostgreSQL.',
    inputSchema: GetPrGovernanceVerdictSchema,
  })
  async getPrGovernanceVerdict(args: GetPrGovernanceVerdictArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_pr_governance_verdict', { id: args?.id });
    try {
      const validated = GetPrGovernanceVerdictSchema.parse(args);
      const record = await this.recordService.getRecord(validated.id, validated.userId);
      if (!record) {
        return {
          error: true,
          message: `Cost estimate record with ID ${validated.id} was not found.`,
        };
      }

      const meta = (record.metadata || {}) as Record<string, unknown>;
      const forecast = meta.forecast || null;
      const verdict = (meta.verdict as string) || 'UNKNOWN';

      return {
        success: true,
        recordId: record.id,
        title: record.title,
        verdict,
        budgetP90Usd: meta.budgetP90Usd ?? null,
        forecast,
        impact: meta.impact || 'unknown',
        createdAt: record.createdAt,
      };
    } catch (err) {
      return formatToolError('get_pr_governance_verdict', err, 'Ensure the record UUID exists and corresponds to a cost estimate.');
    }
  }

  // ============================================================================
  // 3. log_budget_policy_override
  // ============================================================================
  @Tool({
    name: 'log_budget_policy_override',
    description: 'Log an authorized budget exception, manual PR override, or cost governance policy record in Neon PostgreSQL. Saves title, description, and metadata JSONB, returning the created record with UUID.',
    inputSchema: LogBudgetPolicyOverrideSchema,
  })
  async logBudgetPolicyOverride(args: LogBudgetPolicyOverrideArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing log_budget_policy_override in Neon PostgreSQL', { title: args?.title });
    try {
      const validated = LogBudgetPolicyOverrideSchema.parse(args);
      const record = await this.recordService.createRecord(validated);
      return {
        success: true,
        message: `Governance record '${record.title}' was successfully logged in Neon PostgreSQL.`,
        record,
      };
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      await this.recordService.logAudit({
        userId: args?.userId,
        toolName: 'log_budget_policy_override',
        action: 'VALIDATE',
        status: 'VALIDATION_FAILED',
        metadata: { error: safeError, attemptedTitle: args?.title },
      });
      return formatToolError('log_budget_policy_override', err, 'Check input parameters and ensure valid JSON metadata.');
    }
  }

  // ============================================================================
  // 4. get_governance_record
  // ============================================================================
  @Tool({
    name: 'get_governance_record',
    description: 'Retrieve a specific cost governance or policy override record by its unique UUID from Neon PostgreSQL. Returns record attributes and timestamps.',
    inputSchema: GetGovernanceRecordSchema,
  })
  async getGovernanceRecord(args: GetGovernanceRecordArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_governance_record', { id: args?.id });
    try {
      const validated = GetGovernanceRecordSchema.parse(args);
      const record = await this.recordService.getRecord(validated.id, validated.userId);
      if (!record) {
        return {
          error: true,
          message: `Record with ID ${validated.id} was not found in the database.`,
        };
      }
      return {
        success: true,
        record,
      };
    } catch (err) {
      return formatToolError('get_governance_record', err, 'Ensure the record UUID exists and is formatted correctly.');
    }
  }

  // ============================================================================
  // 5. list_governance_ledger
  // ============================================================================
  @Tool({
    name: 'list_governance_ledger',
    description: 'List historical Class1Dev cost governance records stored in Neon PostgreSQL with pagination (limit and offset) and total count metadata.',
    inputSchema: ListGovernanceLedgerSchema,
  })
  async listGovernanceLedger(args: ListGovernanceLedgerArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing list_governance_ledger', { limit: args?.limit, offset: args?.offset });
    try {
      const validated = ListGovernanceLedgerSchema.parse(args || {});
      return await this.recordService.listRecords(validated);
    } catch (err) {
      return formatToolError('list_governance_ledger', err);
    }
  }

  // ============================================================================
  // 6. update_governance_record
  // ============================================================================
  @Tool({
    name: 'update_governance_record',
    description: 'Update the title, description, or JSONB metadata of an existing cost governance record in Neon PostgreSQL by its UUID.',
    inputSchema: UpdateGovernanceRecordSchema,
  })
  async updateGovernanceRecord(args: UpdateGovernanceRecordArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing update_governance_record', { id: args?.id });
    try {
      const validated = UpdateGovernanceRecordSchema.parse(args);
      const updated = await this.recordService.updateRecord(validated);
      return {
        success: true,
        message: `Governance record '${updated.title}' (${updated.id}) updated successfully.`,
        record: updated,
      };
    } catch (err) {
      return formatToolError('update_governance_record', err, 'Verify the record ID exists and that you have permission to modify it.');
    }
  }

  // ============================================================================
  // 7. delete_governance_record
  // ============================================================================
  @Tool({
    name: 'delete_governance_record',
    description: 'Permanently remove a cost governance record by its unique UUID from Neon PostgreSQL. Returns deletion confirmation status.',
    inputSchema: DeleteGovernanceRecordSchema,
  })
  async deleteGovernanceRecord(args: DeleteGovernanceRecordArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing delete_governance_record', { id: args?.id });
    try {
      const validated = DeleteGovernanceRecordSchema.parse(args);
      return await this.recordService.deleteRecord(validated.id, validated.userId);
    } catch (err) {
      return formatToolError('delete_governance_record', err, 'Verify the record ID exists and has not already been deleted.');
    }
  }

  // ============================================================================
  // 8. audit_pr_cost_history
  // ============================================================================
  @Tool({
    name: 'audit_pr_cost_history',
    description: 'Search for historical cost governance records in Neon PostgreSQL matching a query substring across title and description fields.',
    inputSchema: AuditPrCostHistorySchema,
  })
  async auditPrCostHistory(args: AuditPrCostHistoryArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing audit_pr_cost_history', { query: args?.query });
    try {
      const validated = AuditPrCostHistorySchema.parse(args);
      return await this.recordService.searchRecords(validated);
    } catch (err) {
      return formatToolError('audit_pr_cost_history', err);
    }
  }

  // ============================================================================
  // 9. get_finops_compliance_metrics
  // ============================================================================
  @Tool({
    name: 'get_finops_compliance_metrics',
    description: 'Retrieve aggregate FinOps compliance metrics, including total record counts, audit log volume, and action success rates.',
    inputSchema: GetFinopsComplianceMetricsSchema,
  })
  async getFinopsComplianceMetrics(args: GetFinopsComplianceMetricsArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_finops_compliance_metrics');
    try {
      const validated = GetFinopsComplianceMetricsSchema.parse(args || {});
      const stats = await this.recordService.getDatabaseStats(validated);
      return {
        success: true,
        client: 'class1dev',
        statistics: stats,
      };
    } catch (err) {
      return formatToolError('get_finops_compliance_metrics', err);
    }
  }

  // ============================================================================
  // 10. get_service_health
  // ============================================================================
  @Tool({
    name: 'get_service_health',
    description: 'Check health and diagnostic status of the NitroStack MCP server and active Neon PostgreSQL connection pool.',
    inputSchema: GetServiceHealthSchema,
  })
  async getServiceHealth(_args: Record<string, unknown>, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_service_health probe');
    try {
      GetServiceHealthSchema.parse(_args || {});
      return await this.healthService.getSystemStatus();
    } catch (err) {
      return formatToolError('get_service_health', err);
    }
  }
}
