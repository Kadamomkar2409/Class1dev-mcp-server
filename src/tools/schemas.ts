import { z } from 'zod';

/**
 * 1. create_record schema
 */
export const CreateRecordSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').describe('The title of the record to create in the database.'),
  description: z.string().optional().describe('Optional detailed markdown or text description for the record.'),
  metadata: z.record(z.unknown()).optional().describe('Optional arbitrary key-value metadata stored as JSONB.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional owner user ID. Defaults to standard system user if omitted.'),
});
export type CreateRecordArgs = z.infer<typeof CreateRecordSchema>;

/**
 * 2. get_record schema
 */
export const GetRecordSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the record to retrieve.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user ID to enforce tenant scoping. Defaults to authenticated principal if omitted.'),
});
export type GetRecordArgs = z.infer<typeof GetRecordSchema>;

/**
 * 3. list_records schema
 */
export const ListRecordsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of records to return (1-100, default: 20).'),
  offset: z.number().int().min(0).default(0).describe('Number of records to skip for pagination (default: 0).'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional filter by user ID. Defaults to authenticated principal if omitted.'),
});
export type ListRecordsArgs = z.infer<typeof ListRecordsSchema>;

/**
 * 4. update_record schema
 */
export const UpdateRecordSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the record to update.'),
  title: z.string().min(1).optional().describe('Optional updated title for the record.'),
  description: z.string().optional().describe('Optional updated description for the record.'),
  metadata: z.record(z.unknown()).optional().describe('Optional updated JSONB metadata payload.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user ID to enforce tenant isolation. Defaults to authenticated principal if omitted.'),
});
export type UpdateRecordArgs = z.infer<typeof UpdateRecordSchema>;

/**
 * 5. delete_record schema
 */
export const DeleteRecordSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the record to permanently delete.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user ID to enforce tenant isolation. Defaults to authenticated principal if omitted.'),
});
export type DeleteRecordArgs = z.infer<typeof DeleteRecordSchema>;

/**
 * 6. search_records schema
 */
export const SearchRecordsSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').describe('The keyword or substring to match against record titles and descriptions.'),
  limit: z.number().int().min(1).max(50).default(20).optional().describe('Maximum number of matching records to return.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional filter by user ID. Defaults to authenticated principal if omitted.'),
});
export type SearchRecordsArgs = z.infer<typeof SearchRecordsSchema>;

/**
 * 7. get_database_stats schema
 */
export const GetDatabaseStatsSchema = z.object({
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user ID filter for user-specific counts.'),
});
export type GetDatabaseStatsArgs = z.infer<typeof GetDatabaseStatsSchema>;

/**
 * 8. get_system_status schema
 */
export const GetSystemStatusSchema = z.object({}).describe('No parameters required to query system and database health status.');
export type GetSystemStatusArgs = z.infer<typeof GetSystemStatusSchema>;

/**
 * 9. estimate_pr_cost schema
 * Invokes the real Class1 cost-risk takeoff engine on code changes.
 */
export const EstimatePrCostSchema = z.object({
  beforeCode: z.string().min(1, 'beforeCode cannot be empty').max(1_000_000, 'beforeCode exceeds maximum allowed size (1 MB)').describe('Original code before PR changes.'),
  afterCode: z.string().min(1, 'afterCode cannot be empty').max(1_000_000, 'afterCode exceeds maximum allowed size (1 MB)').describe('Updated code after PR changes.'),
  path: z.string().min(1, 'path cannot be empty').describe('Logical file path of the modified file (e.g. app.py, services/billing.py).'),
  budgetP90Usd: z.number().nonnegative('budgetP90Usd must be non-negative').optional().describe('Optional P90 cost ceiling in USD. Triggers BLOCK if P90 > budget, or WARN if P90 >= warnFraction * budget.'),
  prNumber: z.number().int().positive('prNumber must be a positive integer').optional().describe('Optional GitHub or GitLab pull request number.'),
  repo: z.string().optional().describe('Optional repository name (e.g. organization/repository).'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user ID for tenant isolation. Defaults to standard system user if omitted.'),
  samples: z.number().int().min(1000, 'Minimum Monte Carlo samples is 1,000').max(120000, 'Maximum Monte Carlo samples is 120,000').optional().describe('Optional Monte Carlo simulation sample count (default: 10,000).'),
});
export type EstimatePrCostArgs = z.infer<typeof EstimatePrCostSchema>;

/**
 * 10. get_cost_verdict schema
 * Retrieves stored cost estimate forecast and governance verdict by record UUID.
 */
export const GetCostVerdictSchema = z.object({
  id: z.string().uuid('Invalid UUID format').describe('The unique UUID of the cost estimate record.'),
  userId: z.string().uuid('Invalid user UUID').optional().describe('Optional user ID to enforce tenant isolation.'),
});
export type GetCostVerdictArgs = z.infer<typeof GetCostVerdictSchema>;

