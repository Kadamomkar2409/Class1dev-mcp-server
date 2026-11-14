import { ToolDecorator as Tool, ExecutionContext, Injectable } from '@nitrostack/core';
import { RecordService } from '../../services/record.service.js';
import { HealthService } from '../../services/health.service.js';
import { Class1EngineService } from '../../services/class1-engine.service.js';
import { formatToolError, sanitizeErrorMessage } from '../../utils/error-handler.js';
import {
  CreateRecordSchema,
  GetRecordSchema,
  ListRecordsSchema,
  UpdateRecordSchema,
  DeleteRecordSchema,
  SearchRecordsSchema,
  GetDatabaseStatsSchema,
  GetSystemStatusSchema,
  EstimatePrCostSchema,
  GetCostVerdictSchema,
  CreateRecordArgs,
  GetRecordArgs,
  ListRecordsArgs,
  UpdateRecordArgs,
  DeleteRecordArgs,
  SearchRecordsArgs,
  GetDatabaseStatsArgs,
  EstimatePrCostArgs,
  GetCostVerdictArgs,
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
 * Class1Dev MCP Controller Tools
 * Implements the core MCP tools using the NitroStack TypeScript SDK (@nitrostack/core).
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

  @Tool({
    name: 'create_record',
    description: 'Create a persistent record in Neon PostgreSQL for Class1Dev AI cost governance. Saves title, description, and metadata JSONB, returning the created record with UUID.',
    inputSchema: CreateRecordSchema,
  })
  async createRecord(args: CreateRecordArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing create_record in Neon PostgreSQL', { title: args?.title });
    try {
      const validated = CreateRecordSchema.parse(args);
      const record = await this.recordService.createRecord(validated);
      return {
        success: true,
        message: `Record '${record.title}' was successfully created in Neon PostgreSQL.`,
        record,
      };
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      await this.recordService.logAudit({
        userId: args?.userId,
        toolName: 'create_record',
        action: 'VALIDATE',
        status: 'VALIDATION_FAILED',
        metadata: { error: safeError, attemptedTitle: args?.title },
      });
      return formatToolError('create_record', err, 'Check input parameters and ensure valid JSON metadata.');
    }
  }

  @Tool({
    name: 'get_record',
    description: 'Retrieve a specific record by its unique UUID from Neon PostgreSQL. Returns record attributes and timestamps.',
    inputSchema: GetRecordSchema,
  })
  async getRecord(args: GetRecordArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_record', { id: args?.id });
    try {
      const validated = GetRecordSchema.parse(args);
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
      return formatToolError('get_record', err, 'Ensure the record UUID exists and is formatted correctly.');
    }
  }

  @Tool({
    name: 'list_records',
    description: 'List Class1Dev records stored in Neon PostgreSQL with pagination (limit and offset) and total count metadata.',
    inputSchema: ListRecordsSchema,
  })
  async listRecords(args: ListRecordsArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing list_records', { limit: args?.limit, offset: args?.offset });
    try {
      const validated = ListRecordsSchema.parse(args || {});
      return await this.recordService.listRecords(validated);
    } catch (err) {
      return formatToolError('list_records', err);
    }
  }

  @Tool({
    name: 'update_record',
    description: 'Update the title, description, or JSONB metadata of an existing record in Neon PostgreSQL by its UUID.',
    inputSchema: UpdateRecordSchema,
  })
  async updateRecord(args: UpdateRecordArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing update_record', { id: args?.id });
    try {
      const validated = UpdateRecordSchema.parse(args);
      const updated = await this.recordService.updateRecord(validated);
      return {
        success: true,
        message: `Record '${updated.title}' (${updated.id}) updated successfully.`,
        record: updated,
      };
    } catch (err) {
      return formatToolError('update_record', err, 'Verify the record ID exists and that you have permission to modify it.');
    }
  }

  @Tool({
    name: 'delete_record',
    description: 'Permanently delete a record by its unique UUID from Neon PostgreSQL. Returns deletion confirmation status.',
    inputSchema: DeleteRecordSchema,
  })
  async deleteRecord(args: DeleteRecordArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing delete_record', { id: args?.id });
    try {
      const validated = DeleteRecordSchema.parse(args);
      return await this.recordService.deleteRecord(validated.id, validated.userId);
    } catch (err) {
      return formatToolError('delete_record', err, 'Verify the record ID exists and has not already been deleted.');
    }
  }

  @Tool({
    name: 'search_records',
    description: 'Search for records in Neon PostgreSQL matching a query substring across title and description fields.',
    inputSchema: SearchRecordsSchema,
  })
  async searchRecords(args: SearchRecordsArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing search_records', { query: args?.query });
    try {
      const validated = SearchRecordsSchema.parse(args);
      return await this.recordService.searchRecords(validated);
    } catch (err) {
      return formatToolError('search_records', err);
    }
  }

  @Tool({
    name: 'get_database_stats',
    description: 'Retrieve aggregate database statistics, including total record counts, audit log volume, and action success rates.',
    inputSchema: GetDatabaseStatsSchema,
  })
  async getDatabaseStats(args: GetDatabaseStatsArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_database_stats');
    try {
      const validated = GetDatabaseStatsSchema.parse(args || {});
      const stats = await this.recordService.getDatabaseStats(validated);
      return {
        success: true,
        client: 'class1dev',
        statistics: stats,
      };
    } catch (err) {
      return formatToolError('get_database_stats', err);
    }
  }

  @Tool({
    name: 'get_system_status',
    description: 'Check health and diagnostic status of the NitroStack MCP server and active Neon PostgreSQL connection pool.',
    inputSchema: GetSystemStatusSchema,
  })
  async getSystemStatus(_args: Record<string, unknown>, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_system_status probe');
    try {
      GetSystemStatusSchema.parse(_args || {});
      return await this.healthService.getSystemStatus();
    } catch (err) {
      return formatToolError('get_system_status', err);
    }
  }

  @Tool({
    name: 'estimate_pr_cost',
    description: 'Run the real Class1 cost-risk takeoff engine on before/after code changes to estimate monthly LLM cost impact, calculate tail-risk percentiles (P50/P90/P95), and evaluate budget policy verdicts (BLOCK, WARN, PASS, or NO_BUDGET). Persists the forecast and full text report to Neon PostgreSQL.',
    inputSchema: EstimatePrCostSchema,
  })
  async estimatePrCost(args: EstimatePrCostArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing estimate_pr_cost with real Class1 engine', { path: args?.path, prNumber: args?.prNumber });
    try {
      const validated = EstimatePrCostSchema.parse(args);
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
        toolName: 'estimate_pr_cost',
        action: isValidation ? 'VALIDATE' : 'ESTIMATE',
        status: isValidation ? 'VALIDATION_FAILED' : 'ENGINE_FAILURE',
        metadata: { error: safeError, path: args?.path },
      });
      return formatToolError('estimate_pr_cost', err, 'Verify before/after code and engine execution parameters.');
    }
  }

  @Tool({
    name: 'get_cost_verdict',
    description: 'Retrieve a stored Class1 cost-risk forecast and governance verdict (BLOCK, WARN, PASS, or NO_BUDGET) by record UUID from Neon PostgreSQL.',
    inputSchema: GetCostVerdictSchema,
  })
  async getCostVerdict(args: GetCostVerdictArgs, ctx: ExecutionContext) {
    ctx.logger.info('Executing get_cost_verdict', { id: args?.id });
    try {
      const validated = GetCostVerdictSchema.parse(args);
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
      return formatToolError('get_cost_verdict', err, 'Ensure the record UUID exists and corresponds to a cost estimate.');
    }
  }

  // ============================================================================
  // Enterprise AI FinOps & Governance Toolset (Domain Showcase)
  // ============================================================================

  @Tool({
    name: 'evaluate_pr_cost_risk',
    description: 'Run the real Class1 cost-risk takeoff engine on before/after code changes to estimate monthly LLM cost impact, calculate tail-risk percentiles (P50/P90/P95), and evaluate budget policy verdicts (BLOCK, WARN, PASS, or NO_BUDGET). Persists the forecast and full text report to Neon PostgreSQL.',
    inputSchema: EvaluatePrCostRiskSchema,
  })
  async evaluatePrCostRisk(args: EvaluatePrCostRiskArgs, ctx: ExecutionContext) {
    return this.estimatePrCost(args, ctx);
  }

  @Tool({
    name: 'get_pr_governance_verdict',
    description: 'Retrieve a stored Class1 cost-risk forecast and governance verdict (BLOCK, WARN, PASS, or NO_BUDGET) by record UUID from Neon PostgreSQL.',
    inputSchema: GetPrGovernanceVerdictSchema,
  })
  async getPrGovernanceVerdict(args: GetPrGovernanceVerdictArgs, ctx: ExecutionContext) {
    return this.getCostVerdict(args, ctx);
  }

  @Tool({
    name: 'log_budget_policy_override',
    description: 'Log an authorized budget exception, manual PR override, or cost governance policy record in Neon PostgreSQL. Saves title, description, and metadata JSONB, returning the created record with UUID.',
    inputSchema: LogBudgetPolicyOverrideSchema,
  })
  async logBudgetPolicyOverride(args: LogBudgetPolicyOverrideArgs, ctx: ExecutionContext) {
    return this.createRecord(args, ctx);
  }

  @Tool({
    name: 'get_governance_record',
    description: 'Retrieve a specific cost governance or policy override record by its unique UUID from Neon PostgreSQL. Returns record attributes and timestamps.',
    inputSchema: GetGovernanceRecordSchema,
  })
  async getGovernanceRecord(args: GetGovernanceRecordArgs, ctx: ExecutionContext) {
    return this.getRecord(args, ctx);
  }

  @Tool({
    name: 'list_governance_ledger',
    description: 'List historical Class1Dev cost governance records stored in Neon PostgreSQL with pagination (limit and offset) and total count metadata.',
    inputSchema: ListGovernanceLedgerSchema,
  })
  async listGovernanceLedger(args: ListGovernanceLedgerArgs, ctx: ExecutionContext) {
    return this.listRecords(args, ctx);
  }

  @Tool({
    name: 'update_governance_record',
    description: 'Update the title, description, or JSONB metadata of an existing cost governance record in Neon PostgreSQL by its UUID.',
    inputSchema: UpdateGovernanceRecordSchema,
  })
  async updateGovernanceRecord(args: UpdateGovernanceRecordArgs, ctx: ExecutionContext) {
    return this.updateRecord(args, ctx);
  }

  @Tool({
    name: 'delete_governance_record',
    description: 'Permanently remove a cost governance record by its unique UUID from Neon PostgreSQL. Returns deletion confirmation status.',
    inputSchema: DeleteGovernanceRecordSchema,
  })
  async deleteGovernanceRecord(args: DeleteGovernanceRecordArgs, ctx: ExecutionContext) {
    return this.deleteRecord(args, ctx);
  }

  @Tool({
    name: 'audit_pr_cost_history',
    description: 'Search for historical cost governance records in Neon PostgreSQL matching a query substring across title and description fields.',
    inputSchema: AuditPrCostHistorySchema,
  })
  async auditPrCostHistory(args: AuditPrCostHistoryArgs, ctx: ExecutionContext) {
    return this.searchRecords(args, ctx);
  }

  @Tool({
    name: 'get_finops_compliance_metrics',
    description: 'Retrieve aggregate FinOps compliance metrics, including total record counts, audit log volume, and action success rates.',
    inputSchema: GetFinopsComplianceMetricsSchema,
  })
  async getFinopsComplianceMetrics(args: GetFinopsComplianceMetricsArgs, ctx: ExecutionContext) {
    return this.getDatabaseStats(args, ctx);
  }

  @Tool({
    name: 'get_service_health',
    description: 'Check health and diagnostic status of the NitroStack MCP server and active Neon PostgreSQL connection pool.',
    inputSchema: GetServiceHealthSchema,
  })
  async getServiceHealth(args: GetServiceHealthArgs, ctx: ExecutionContext) {
    return this.getSystemStatus(args, ctx);
  }
}
