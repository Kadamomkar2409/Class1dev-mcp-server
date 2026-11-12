import { fileURLToPath } from 'url';
import path from 'path';
import { pool } from './index.js';
import { config } from '../config.js';

/**
 * Migration runner
 * Applies DDL schema to Neon PostgreSQL to initialize tables, constraints, and indexes.
 */
export async function runMigrations() {
  console.log('🚀 Running database migrations against Neon PostgreSQL...');
  
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Please configure .env before running migrations.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 1. Enable uuid-ossp or pgcrypto extension for UUID generation if needed
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 2. Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);`);

    // 3. Create records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS records_user_id_idx ON records(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS records_title_idx ON records(title);`);
    await client.query(`CREATE INDEX IF NOT EXISTS records_created_at_idx ON records(created_at);`);

    // 4. Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        tool_name TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_logs_tool_name_idx ON audit_logs(tool_name);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);`);

    await client.query('COMMIT;');
    console.log('✅ Migrations completed successfully. Tables (users, records, audit_logs) are ready in Neon.');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Migration failed:', err);
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
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration error:', err);
      process.exit(1);
    });
}

