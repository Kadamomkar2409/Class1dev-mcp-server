import { z } from 'zod';

/**
 * ==============================================================================
 * Class1Dev AI FinOps & Cost Governance Tool Schemas
 * 
 * Provides both enterprise FinOps domain schemas and full backward compatibility
 * aliases for standard PRD database tools.
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. evaluate_pr_cost_risk (PRD alias: estimate_pr_cost)
// ------------------------------------------------------------------------------
export const EvaluatePrCostRiskSchema = z.object({
  beforeCode: z.string().min(1, 'beforeCode cannot be empty').max(1_000_000, 'beforeCode exceeds maximum allowed size (1 MB)').describe('Original code before PR changes.'),
  afterCode: z.string().min(1, 'afterCode cannot be empty').max(1_000_000, 'afterCode exceeds maximum allowed size (1 MB)').describe('Updated code after PR changes.'),
  path: z.string().min(1, 'path cannot be empty').describe('Logical file path of the modified file (e.g. app.py, services/billing.py).'),
  budgetP90Usd: z.number().nonnegative('budgetP90Usd must be non-negative').optional().describe('Optional monthly P90 cost ceiling in USD. Triggers BLOCK if P90 > budget, or WARN if P90 >= warnFraction * budget.'),
  prNumber: z.number().int().positive('prNumber must be a positive integer').optional().describe('Optional GitHub or GitLab pull request number.'),
  repo: z.string().optional().describe('Optional repository name (e.g. organization/repository).'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user UUID for tenant isolation. Defaults to standard system user if omitted.'),
  samples: z.number().int().min(1000, 'Minimum Monte Carlo samples is 1,000').max(120000, 'Maximum Monte Carlo samples is 120,000').optional().describe('Optional Monte Carlo simulation sample count (default: 10,000).'),
});
export type EvaluatePrCostRiskArgs = z.infer<typeof EvaluatePrCostRiskSchema>;
export const EstimatePrCostSchema = EvaluatePrCostRiskSchema;
export type EstimatePrCostArgs = EvaluatePrCostRiskArgs;

// ------------------------------------------------------------------------------
// 2. get_pr_governance_verdict (PRD alias: get_cost_verdict)
// ------------------------------------------------------------------------------
export const GetPrGovernanceVerdictSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the cost estimate record.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user UUID to enforce tenant isolation.'),
});
export type GetPrGovernanceVerdictArgs = z.infer<typeof GetPrGovernanceVerdictSchema>;
export const GetCostVerdictSchema = GetPrGovernanceVerdictSchema;
export type GetCostVerdictArgs = GetPrGovernanceVerdictArgs;

// ------------------------------------------------------------------------------
// 3. log_budget_policy_override (PRD alias: create_record)
// ------------------------------------------------------------------------------
export const LogBudgetPolicyOverrideSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').describe('Title of the cost policy override, budget exception, or governance record to persist in Neon PostgreSQL.'),
  description: z.string().optional().describe('Detailed explanation or business justification for the policy exception or cost record.'),
  metadata: z.record(z.unknown()).optional().describe('Arbitrary key-value metadata payload stored as JSONB (e.g. approvedBy, ticketId, budgetDelta).'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Owner user UUID (defaults to standard system user).'),
});
export type LogBudgetPolicyOverrideArgs = z.infer<typeof LogBudgetPolicyOverrideSchema>;
export const CreateRecordSchema = LogBudgetPolicyOverrideSchema;
export type CreateRecordArgs = LogBudgetPolicyOverrideArgs;

// ------------------------------------------------------------------------------
// 4. get_governance_record (PRD alias: get_record)
// ------------------------------------------------------------------------------
export const GetGovernanceRecordSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the cost governance record to retrieve.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user UUID to enforce tenant scoping. Defaults to authenticated principal if omitted.'),
});
export type GetGovernanceRecordArgs = z.infer<typeof GetGovernanceRecordSchema>;
export const GetRecordSchema = GetGovernanceRecordSchema;
export type GetRecordArgs = GetGovernanceRecordArgs;

// ------------------------------------------------------------------------------
// 5. list_governance_ledger (PRD alias: list_records)
// ------------------------------------------------------------------------------
export const ListGovernanceLedgerSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of governance records to return (1-100, default: 20).'),
  offset: z.number().int().min(0).default(0).describe('Number of records to skip for pagination (default: 0).'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional filter by user UUID. Defaults to authenticated principal if omitted.'),
});
export type ListGovernanceLedgerArgs = z.infer<typeof ListGovernanceLedgerSchema>;
export const ListRecordsSchema = ListGovernanceLedgerSchema;
export type ListRecordsArgs = ListGovernanceLedgerArgs;

// ------------------------------------------------------------------------------
// 6. update_governance_record (PRD alias: update_record)
// ------------------------------------------------------------------------------
export const UpdateGovernanceRecordSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the cost governance record to update.'),
  title: z.string().min(1).optional().describe('Updated title or summary of the governance record.'),
  description: z.string().optional().describe('Updated justification or notes for the governance record.'),
  metadata: z.record(z.unknown()).optional().describe('Updated key-value metadata JSONB payload.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user UUID to enforce tenant isolation.'),
});
export type UpdateGovernanceRecordArgs = z.infer<typeof UpdateGovernanceRecordSchema>;
export const UpdateRecordSchema = UpdateGovernanceRecordSchema;
export type UpdateRecordArgs = UpdateGovernanceRecordArgs;

// ------------------------------------------------------------------------------
// 7. delete_governance_record (PRD alias: delete_record)
// ------------------------------------------------------------------------------
export const DeleteGovernanceRecordSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the cost governance record to permanently delete.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user UUID to enforce tenant isolation.'),
});
export type DeleteGovernanceRecordArgs = z.infer<typeof DeleteGovernanceRecordSchema>;
export const DeleteRecordSchema = DeleteGovernanceRecordSchema;
export type DeleteRecordArgs = DeleteGovernanceRecordArgs;

// ------------------------------------------------------------------------------
// 8. audit_pr_cost_history (PRD alias: search_records)
// ------------------------------------------------------------------------------
export const AuditPrCostHistorySchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').describe('Keyword or search string to match across PR cost evaluations, model migrations, and policy records.'),
  limit: z.number().int().min(1).max(50).default(20).optional().describe('Maximum number of matching records to return.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional filter by user UUID. Defaults to authenticated principal if omitted.'),
});
export type AuditPrCostHistoryArgs = z.infer<typeof AuditPrCostHistorySchema>;
export const SearchRecordsSchema = AuditPrCostHistorySchema;
export type SearchRecordsArgs = AuditPrCostHistoryArgs;

// ------------------------------------------------------------------------------
// 9. get_finops_compliance_metrics (PRD alias: get_database_stats)
// ------------------------------------------------------------------------------
export const GetFinopsComplianceMetricsSchema = z.object({
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user UUID filter for tenant-specific FinOps compliance statistics.'),
});
export type GetFinopsComplianceMetricsArgs = z.infer<typeof GetFinopsComplianceMetricsSchema>;
export const GetDatabaseStatsSchema = GetFinopsComplianceMetricsSchema;
export type GetDatabaseStatsArgs = GetFinopsComplianceMetricsArgs;

// ------------------------------------------------------------------------------
// 10. get_service_health (PRD alias: get_system_status)
// ------------------------------------------------------------------------------
export const GetServiceHealthSchema = z.object({}).describe('No parameters required to query live service health, database latency, and transport telemetry.');
export type GetServiceHealthArgs = z.infer<typeof GetServiceHealthSchema>;
export const GetSystemStatusSchema = GetServiceHealthSchema;
export type GetSystemStatusArgs = GetServiceHealthArgs;
