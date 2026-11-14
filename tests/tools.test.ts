import { describe, it, expect } from 'vitest';
import {
  CreateRecordSchema,
  GetRecordSchema,
  ListRecordsSchema,
  UpdateRecordSchema,
  DeleteRecordSchema,
  SearchRecordsSchema,
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
} from '../src/tools/schemas.js';

describe('MCP Tool Schema Validation', () => {
  it('should validate valid create_record input', () => {
    const valid = {
      title: 'Production Incident #402',
      description: 'API gateway timeout investigation',
      metadata: { severity: 'high', tags: ['incident', 'api'] },
    };
    const parsed = CreateRecordSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('should reject create_record with empty title', () => {
    const invalid = {
      title: '',
    };
    const parsed = CreateRecordSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('should enforce UUID format on get_record', () => {
    const valid = { id: '123e4567-e89b-12d3-a456-426614174000' };
    const invalid = { id: 'not-a-valid-uuid' };

    expect(GetRecordSchema.safeParse(valid).success).toBe(true);
    expect(GetRecordSchema.safeParse(invalid).success).toBe(false);
  });

  it('should clamp and default pagination on list_records', () => {
    const parsed = ListRecordsSchema.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);

    const custom = ListRecordsSchema.parse({ limit: 50, offset: 10 });
    expect(custom.limit).toBe(50);
    expect(custom.offset).toBe(10);
  });

  it('should enforce UUID on update_record and allow partial fields', () => {
    const valid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Updated Title',
    };
    expect(UpdateRecordSchema.safeParse(valid).success).toBe(true);
  });

  it('should enforce UUID on delete_record', () => {
    const valid = { id: '123e4567-e89b-12d3-a456-426614174000' };
    const invalid = { id: '12345' };

    expect(DeleteRecordSchema.safeParse(valid).success).toBe(true);
    expect(DeleteRecordSchema.safeParse(invalid).success).toBe(false);
  });

  it('should reject search_records with empty query', () => {
    const emptyQuery = { query: '' };
    expect(SearchRecordsSchema.safeParse(emptyQuery).success).toBe(false);

    const validQuery = { query: 'incident' };
    expect(SearchRecordsSchema.safeParse(validQuery).success).toBe(true);
  });

  describe('FinOps Enterprise Domain Tool Schemas', () => {
    it('should validate evaluate_pr_cost_risk schema with valid inputs', () => {
      const valid = {
        beforeCode: 'print("hello")',
        afterCode: 'print("world")',
        path: 'services/llm.py',
        budgetP90Usd: 2500,
        samples: 1000,
      };
      const parsed = EvaluatePrCostRiskSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.samples).toBe(1000);
        expect(parsed.data.budgetP90Usd).toBe(2500);
      }
    });

    it('should validate log_budget_policy_override schema', () => {
      const valid = {
        title: 'Q4 AI Pipeline Budget Override',
        description: 'Approved by VP of Eng for holiday shopping traffic surge',
        metadata: {
          approvedBy: 'vp-eng',
          maxP90AllowanceUsd: 12000,
          tier: 'CRITICAL',
        },
      };
      const parsed = LogBudgetPolicyOverrideSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('should reject log_budget_policy_override with empty title', () => {
      expect(LogBudgetPolicyOverrideSchema.safeParse({ title: '', description: 'ok' }).success).toBe(false);
    });

    it('should validate get_governance_record and get_pr_governance_verdict with UUID', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(GetGovernanceRecordSchema.safeParse({ id: validUuid }).success).toBe(true);
      expect(GetGovernanceRecordSchema.safeParse({ id: 'bad' }).success).toBe(false);
      expect(GetPrGovernanceVerdictSchema.safeParse({ id: validUuid }).success).toBe(true);
      expect(GetPrGovernanceVerdictSchema.safeParse({ id: 'bad' }).success).toBe(false);
    });

    it('should validate list_governance_ledger pagination defaults', () => {
      const parsed = ListGovernanceLedgerSchema.parse({});
      expect(parsed.limit).toBe(20);
      expect(parsed.offset).toBe(0);
    });

    it('should validate audit_pr_cost_history search query', () => {
      expect(AuditPrCostHistorySchema.safeParse({ query: 'PR #301' }).success).toBe(true);
      expect(AuditPrCostHistorySchema.safeParse({ query: '' }).success).toBe(false);
    });

    it('should validate get_finops_compliance_metrics and get_service_health schemas', () => {
      expect(GetFinopsComplianceMetricsSchema.safeParse({}).success).toBe(true);
      expect(GetServiceHealthSchema.safeParse({}).success).toBe(true);
    });
  });
});


