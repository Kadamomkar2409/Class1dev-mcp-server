import { eq, desc, sql, and } from 'drizzle-orm';
import { Injectable } from '@nitrostack/core';
import { db } from '../db/index.js';
import { records, auditLogs, RecordItem, NewRecordItem } from '../db/schema.js';
import { config } from '../config.js';
import { sanitizeErrorMessage } from '../utils/error-handler.js';

export interface CreateRecordInput {
  userId?: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ListRecordsInput {
  userId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateRecordInput {
  id: string;
  userId?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchRecordsInput {
  query: string;
  userId?: string;
  limit?: number;
}

/**
 * RecordService
 * Implements persistent business logic, strict multi-tenant isolation,
 * telemetry queries, and audit log generation in Neon PostgreSQL.
 */
@Injectable()
export class RecordService {
  /**
   * 1. create_record
   * Creates a persistent record in Neon PostgreSQL and writes an audit log.
   */
  async createRecord(input: CreateRecordInput): Promise<RecordItem> {
    const userId = input.userId || config.DEFAULT_USER_ID;

    try {
      const [created] = await db
        .insert(records)
        .values({
          userId,
          title: input.title,
          description: input.description || null,
          metadata: input.metadata || {},
        })
        .returning();

      await this.logAudit({
        userId,
        toolName: 'create_record',
        action: 'CREATE',
        status: 'SUCCESS',
        metadata: { recordId: created.id, title: created.title },
      });

      return created;
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      await this.logAudit({
        userId,
        toolName: 'create_record',
        action: 'CREATE',
        status: 'ERROR',
        metadata: { error: safeError, attemptedTitle: input.title },
      });
      throw new Error(`Failed to create record: ${safeError}`);
    }
  }

  /**
   * Resolves effective tenant userId.
   * If caller passes a userId, scopes to that userId.
   * If caller omits userId, defaults to config.DEFAULT_USER_ID (authenticated principal)
   * unless ALLOW_CROSS_TENANT_READS is explicitly enabled.
   */
  public resolveTenantUserId(requestedUserId?: string): string | undefined {
    if (requestedUserId) return requestedUserId;
    if (config.ALLOW_CROSS_TENANT_READS) return undefined;
    return config.DEFAULT_USER_ID;
  }

  /**
   * 2. get_record
   * Retrieves a single record by its UUID, enforcing tenant isolation.
   * Scoped to authenticated principal (DEFAULT_USER_ID) by default.
   */
  async getRecord(id: string, requestedUserId?: string): Promise<RecordItem | null> {
    const userId = this.resolveTenantUserId(requestedUserId);
    try {
      const conditions = [eq(records.id, id)];
      if (userId) {
        conditions.push(eq(records.userId, userId));
      }

      const [record] = await db
        .select()
        .from(records)
        .where(and(...conditions))
        .limit(1);

      await this.logAudit({
        userId,
        toolName: 'get_record',
        action: 'READ',
        status: record ? 'SUCCESS' : 'NOT_FOUND',
        metadata: { recordId: id, filteredByUser: !!userId },
      });

      return record || null;
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      await this.logAudit({
        userId,
        toolName: 'get_record',
        action: 'READ',
        status: 'ERROR',
        metadata: { recordId: id, error: safeError },
      });
      throw new Error(`Failed to retrieve record: ${safeError}`);
    }
  }

  /**
   * 3. list_records
   * Returns a paginated list of records with total count metadata.
   * Scoped to authenticated principal (DEFAULT_USER_ID) by default.
   */
  async listRecords(input: ListRecordsInput = {}) {
    const limit = Math.min(Math.max(input.limit || 20, 1), 100);
    const offset = Math.max(input.offset || 0, 0);
    const userId = this.resolveTenantUserId(input.userId);

    const conditions = [];
    if (userId) {
      conditions.push(eq(records.userId, userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    try {
      const items = await db
        .select()
        .from(records)
        .where(whereClause)
        .orderBy(desc(records.createdAt))
        .limit(limit)
        .offset(offset);

      // Total count query
      const [countResult] = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(records)
        .where(whereClause);

      const total = countResult?.count || 0;

      await this.logAudit({
        userId,
        toolName: 'list_records',
        action: 'LIST',
        status: 'SUCCESS',
        metadata: { count: items.length, total, limit, offset },
      });

      return {
        records: items,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + items.length < total,
        },
      };
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      await this.logAudit({
        userId,
        toolName: 'list_records',
        action: 'LIST',
        status: 'ERROR',
        metadata: { error: safeError },
      });
      throw new Error(`Failed to list records: ${safeError}`);
    }
  }

  /**
   * 4. update_record
   * Updates an existing record's title, description, or metadata.
   * Enforces tenant isolation: users cannot update records owned by others.
   */
  async updateRecord(input: UpdateRecordInput): Promise<RecordItem> {
    const requestingUserId = input.userId || config.DEFAULT_USER_ID;
    try {
      // First, look up the record to verify existence and ownership
      const [existing] = await db
        .select()
        .from(records)
        .where(eq(records.id, input.id))
        .limit(1);

      if (!existing) {
        await this.logAudit({
          userId: requestingUserId,
          toolName: 'update_record',
          action: 'UPDATE',
          status: 'ERROR',
          metadata: { recordId: input.id, error: 'Record not found' },
        });
        throw new Error(`Record with ID ${input.id} was not found.`);
      }

      // Enforce tenant isolation
      if (existing.userId !== requestingUserId) {
        await this.logAudit({
          userId: requestingUserId,
          toolName: 'update_record',
          action: 'UPDATE',
          status: 'ERROR',
          metadata: { recordId: input.id, error: 'Tenant isolation: cross-user modification rejected' },
        });
        throw new Error(`Unauthorized: Record ${input.id} belongs to another user.`);
      }

      const updateData: Partial<NewRecordItem> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.metadata !== undefined) updateData.metadata = input.metadata;

      const [updated] = await db
        .update(records)
        .set(updateData)
        .where(eq(records.id, input.id))
        .returning();

      await this.logAudit({
        userId: updated.userId,
        toolName: 'update_record',
        action: 'UPDATE',
        status: 'SUCCESS',
        metadata: { recordId: updated.id, updatedFields: Object.keys(updateData) },
      });

      return updated;
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      if (!(err instanceof Error && err.message.includes('Record with ID') || err instanceof Error && err.message.includes('Unauthorized'))) {
        await this.logAudit({
          userId: requestingUserId,
          toolName: 'update_record',
          action: 'UPDATE',
          status: 'ERROR',
          metadata: { recordId: input.id, error: safeError },
        });
      }
      throw new Error(safeError);
    }
  }

  /**
   * 5. delete_record
   * Permanently deletes a record by its UUID.
   * Enforces tenant isolation: users cannot delete records owned by others.
   */
  async deleteRecord(id: string, userId?: string): Promise<{ success: boolean; id: string; message: string }> {
    const requestingUserId = userId || config.DEFAULT_USER_ID;
    try {
      // First, check existence and ownership
      const [existing] = await db
        .select()
        .from(records)
        .where(eq(records.id, id))
        .limit(1);

      if (!existing) {
        await this.logAudit({
          userId: requestingUserId,
          toolName: 'delete_record',
          action: 'DELETE',
          status: 'ERROR',
          metadata: { recordId: id, error: 'Record not found' },
        });
        throw new Error(`Record with ID ${id} was not found or has already been deleted.`);
      }

      // Enforce tenant isolation
      if (existing.userId !== requestingUserId) {
        await this.logAudit({
          userId: requestingUserId,
          toolName: 'delete_record',
          action: 'DELETE',
          status: 'ERROR',
          metadata: { recordId: id, error: 'Tenant isolation: cross-user deletion rejected' },
        });
        throw new Error(`Unauthorized: Record ${id} belongs to another user.`);
      }

      await db
        .delete(records)
        .where(eq(records.id, id));

      await this.logAudit({
        userId: existing.userId,
        toolName: 'delete_record',
        action: 'DELETE',
        status: 'SUCCESS',
        metadata: { recordId: existing.id, title: existing.title },
      });

      return {
        success: true,
        id: existing.id,
        message: `Record '${existing.title}' (${existing.id}) was successfully deleted.`,
      };
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      if (!(err instanceof Error && err.message.includes('Record with ID') || err instanceof Error && err.message.includes('Unauthorized'))) {
        await this.logAudit({
          userId: requestingUserId,
          toolName: 'delete_record',
          action: 'DELETE',
          status: 'ERROR',
          metadata: { recordId: id, error: safeError },
        });
      }
      throw new Error(safeError);
    }
  }

  /**
   * 6. search_records
   * Full-text / substring search across title and description fields.
   * Scoped to authenticated principal (DEFAULT_USER_ID) by default.
   */
  async searchRecords(input: SearchRecordsInput) {
    const limit = Math.min(Math.max(input.limit || 20, 1), 50);
    const searchPattern = `%${input.query}%`;
    const userId = this.resolveTenantUserId(input.userId);

    const searchCondition = sql`(${records.title} ILIKE ${searchPattern} OR ${records.description} ILIKE ${searchPattern})`;

    const whereClause = userId
      ? and(eq(records.userId, userId), searchCondition)
      : searchCondition;

    try {
      const matching = await db
        .select()
        .from(records)
        .where(whereClause)
        .orderBy(desc(records.createdAt))
        .limit(limit);

      await this.logAudit({
        userId,
        toolName: 'search_records',
        action: 'SEARCH',
        status: 'SUCCESS',
        metadata: { query: input.query, resultsFound: matching.length },
      });

      return {
        query: input.query,
        resultsFound: matching.length,
        records: matching,
      };
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      await this.logAudit({
        userId,
        toolName: 'search_records',
        action: 'SEARCH',
        status: 'ERROR',
        metadata: { query: input.query, error: safeError },
      });
      throw new Error(`Search failed: ${safeError}`);
    }
  }

  /**
   * 7. get_database_stats
   * Provides database aggregates, table counts, and recent activity metrics.
   * Scoped to authenticated principal (DEFAULT_USER_ID) by default.
   */
  async getDatabaseStats(input: { userId?: string } = {}) {
    const userId = this.resolveTenantUserId(input.userId);
    const filters = userId ? eq(records.userId, userId) : undefined;

    try {
      const [recordsCount] = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(records)
        .where(filters);

      const [auditCount] = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(auditLogs);

      const [recentActions] = await db
        .select({
          successfulActions: sql<number>`cast(count(*) filter (where ${auditLogs.status} = 'SUCCESS') as integer)`,
          failedActions: sql<number>`cast(count(*) filter (where ${auditLogs.status} != 'SUCCESS') as integer)`,
        })
        .from(auditLogs);

      await this.logAudit({
        userId,
        toolName: 'get_database_stats',
        action: 'STATS',
        status: 'SUCCESS',
        metadata: { filteredByUser: !!userId },
      });

      return {
        totalRecords: recordsCount?.count || 0,
        totalAuditLogs: auditCount?.count || 0,
        recentActions: {
          successful: recentActions?.successfulActions || 0,
          failed: recentActions?.failedActions || 0,
        },
        filterApplied: filters ? { userId } : null,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      const safeError = sanitizeErrorMessage(err);
      await this.logAudit({
        userId,
        toolName: 'get_database_stats',
        action: 'STATS',
        status: 'ERROR',
        metadata: { error: safeError },
      });
      throw new Error(`Failed to retrieve stats: ${safeError}`);
    }
  }

  /**
   * Helper: Writes an entry into the audit_logs table.
   * Fire-and-forget safe: audit errors are caught and never crash the business operation.
   */
  async logAudit(entry: {
    userId?: string;
    toolName: string;
    action: string;
    status: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await db.insert(auditLogs).values({
        userId: entry.userId || null,
        toolName: entry.toolName,
        action: entry.action,
        status: entry.status,
        metadata: entry.metadata || {},
      });
    } catch (err) {
      console.error('⚠️  Failed to record audit log:', err);
    }
  }
}

export const recordService = new RecordService();
