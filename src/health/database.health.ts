import { HealthCheck, HealthCheckInterface, HealthCheckResult } from '@nitrostack/core';
import { checkDatabaseConnection } from '../db/index.js';

/**
 * Neon PostgreSQL & System Health Check Provider
 * Registered with the NitroStack MCP framework to monitor live DB connectivity and pool health.
 */
@HealthCheck({
  name: 'database',
  description: 'Neon PostgreSQL serverless pool and system health probe',
  interval: 30,
})
export class DatabaseHealthCheck implements HealthCheckInterface {
  private readonly startTime = Date.now();

  async check(): Promise<HealthCheckResult> {
    try {
      const dbStatus = await checkDatabaseConnection();
      const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      const mem = process.memoryUsage();
      const heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;

      if (!dbStatus.connected) {
        return {
          status: 'down',
          message: 'Neon PostgreSQL connection check failed',
          details: {
            error: dbStatus.error,
            uptime: `${uptimeSeconds}s`,
            provider: 'Neon PostgreSQL (Serverless)',
          },
        };
      }

      return {
        status: 'up',
        message: 'Neon PostgreSQL and MCP server operational',
        details: {
          database: 'Neon PostgreSQL',
          latencyMs: `${dbStatus.latencyMs}ms`,
          version: dbStatus.version,
          uptime: `${uptimeSeconds}s`,
          memoryHeapUsedMb: `${heapUsedMb}MB`,
        },
      };
    } catch (err) {
      return {
        status: 'down',
        message: 'Health probe failure',
        details: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

