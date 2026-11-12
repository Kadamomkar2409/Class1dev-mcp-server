import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const DEFAULT_DEV_SECRET = 'dev_secret_change_in_production_mcp_key_2026';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required to connect to Neon PostgreSQL'),
  MCP_TRANSPORT: z.enum(['streamable-http', 'stdio']).default('streamable-http'),
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
  DEFAULT_USER_ID: z.string().uuid().default('00000000-0000-0000-0000-000000000001'),
  ALLOW_CROSS_TENANT_READS: z.coerce.boolean().default(false),
  CLASS1_PYTHON_PATH: z.string().optional(),
  CLASS1_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  CLASS1_WARN_FRACTION: z.coerce.number().min(0.01).max(1.0).default(0.8),
  CLASS1_MC_SAMPLES: z.coerce.number().int().min(1000).max(120000).default(10000),
  CLASS1_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  CLASS1_MAX_OUTPUT_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Fatal: Invalid environment configuration in production. Refusing to start.');
  }
}

const rawSecret = process.env.AUTH_SECRET || (parsed.success ? parsed.data.AUTH_SECRET : DEFAULT_DEV_SECRET);
const isProduction = process.env.NODE_ENV === 'production';

// Strict validation of AUTH_SECRET
if (isProduction) {
  if (!rawSecret || rawSecret === DEFAULT_DEV_SECRET || rawSecret.length < 32) {
    throw new Error('Fatal: In production, AUTH_SECRET must be set, not equal to the default dev secret, and at least 32 characters long.');
  }
}

export const config = {
  NODE_ENV: parsed.success ? parsed.data.NODE_ENV : (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development',
  PORT: parsed.success ? parsed.data.PORT : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000),
  DATABASE_URL: parsed.success ? parsed.data.DATABASE_URL : (process.env.DATABASE_URL || ''),
  MCP_TRANSPORT: parsed.success ? parsed.data.MCP_TRANSPORT : 'streamable-http',
  AUTH_SECRET: rawSecret,
  DEFAULT_USER_ID: parsed.success ? parsed.data.DEFAULT_USER_ID : '00000000-0000-0000-0000-000000000001',
  ALLOW_CROSS_TENANT_READS: parsed.success ? parsed.data.ALLOW_CROSS_TENANT_READS : (process.env.ALLOW_CROSS_TENANT_READS === 'true'),
  CLASS1_PYTHON_PATH: parsed.success && parsed.data.CLASS1_PYTHON_PATH ? parsed.data.CLASS1_PYTHON_PATH : (process.env.CLASS1_PYTHON_PATH || ''),
  CLASS1_TIMEOUT_MS: parsed.success ? parsed.data.CLASS1_TIMEOUT_MS : 30000,
  CLASS1_WARN_FRACTION: parsed.success ? parsed.data.CLASS1_WARN_FRACTION : 0.8,
  CLASS1_MC_SAMPLES: parsed.success ? parsed.data.CLASS1_MC_SAMPLES : 10000,
  CLASS1_MAX_CONCURRENCY: parsed.success ? parsed.data.CLASS1_MAX_CONCURRENCY : 2,
  CLASS1_MAX_OUTPUT_BYTES: parsed.success ? parsed.data.CLASS1_MAX_OUTPUT_BYTES : 5 * 1024 * 1024,
};
