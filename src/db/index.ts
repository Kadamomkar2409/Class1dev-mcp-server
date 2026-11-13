import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';
import { config } from '../config.js';
import { sanitizeErrorMessage, extractErrorDetails } from '../utils/error-handler.js';

// Configure Neon serverless connection pool with WebSocket constructor
neonConfig.webSocketConstructor = ws;

// Configure Neon serverless connection pool
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

/**
 * Checks connectivity to the Neon PostgreSQL instance.
 * Returns latency in milliseconds and database version.
 * Handles timeouts and sanitizes error responses.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
}> {
  const start = Date.now();
  try {
    // 5-second timeout promise race to prevent hanging health checks
    const queryPromise = pool.query('SELECT version();');
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database query timed out')), 5000)
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);
    const latencyMs = Date.now() - start;
    const version = result.rows[0]?.version || 'PostgreSQL (Neon Serverless)';

    return {
      connected: true,
      latencyMs,
      version,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const { className, message: rawMsg } = extractErrorDetails(error);
    const sanitizedMsg = sanitizeErrorMessage(error);
    const formattedError = sanitizedMsg.includes(className) ? sanitizedMsg : `${className}: ${sanitizedMsg}`;

    // Always log the real error class and message to stderr (critical for STDIO mode and Studio console)
    console.error(`[Health Check Database Error] ${className}: ${rawMsg}`);

    return {
      connected: false,
      latencyMs,
      error: formattedError,
    };
  }
}
