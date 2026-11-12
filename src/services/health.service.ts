import { Injectable } from '@nitrostack/core';
import { checkDatabaseConnection } from '../db/index.js';
import { config } from '../config.js';

@Injectable()
export class HealthService {
  /**
   * 8. get_system_status & /health probe
   * Inspects application health, memory, uptime, and live Neon PostgreSQL connectivity.
   */
  async getSystemStatus() {
    const dbStatus = await checkDatabaseConnection();

    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    const isHealthy = dbStatus.connected;

    return {
      status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
      isHealthy,
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      environment: config.NODE_ENV,
      transport: config.MCP_TRANSPORT,
      service: {
        name: 'class1-neon-mcp-server',
        version: '1.0.0',
      },
      database: {
        provider: 'Neon PostgreSQL (Serverless)',
        connected: dbStatus.connected,
        latencyMs: dbStatus.latencyMs,
        version: dbStatus.version || 'Unknown',
        error: dbStatus.error,
      },
      system: {
        memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        memoryHeapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        nodeVersion: process.version,
        platform: process.platform,
      },
    };
  }
}

export const healthService = new HealthService();
