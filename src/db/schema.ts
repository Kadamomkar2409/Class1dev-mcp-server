import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Users Table
 * Stores system users and identity context for multi-tenant data isolation.
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('users_email_idx').on(table.email),
]);

/**
 * Records Table
 * Core entity table managed by MCP tools.
 */
export const records = pgTable('records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('records_user_id_idx').on(table.userId),
  index('records_title_idx').on(table.title),
  index('records_created_at_idx').on(table.createdAt),
]);

/**
 * Audit Logs Table
 * Tracks all tool actions, queries, mutations, and outcomes for security governance.
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  toolName: text('tool_name').notNull(),
  action: text('action').notNull(),
  status: text('status').notNull(), // 'SUCCESS' | 'ERROR' | 'UNAUTHORIZED' | 'VALIDATION_FAILED'
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_logs_user_id_idx').on(table.userId),
  index('audit_logs_tool_name_idx').on(table.toolName),
  index('audit_logs_created_at_idx').on(table.createdAt),
]);

/**
 * Relational definitions for Drizzle query builder
 */
export const usersRelations = relations(users, ({ many }) => ({
  records: many(records),
  auditLogs: many(auditLogs),
}));

export const recordsRelations = relations(records, ({ one }) => ({
  user: one(users, {
    fields: [records.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RecordItem = typeof records.$inferSelect;
export type NewRecordItem = typeof records.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

