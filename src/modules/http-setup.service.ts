import { Injectable, OnApplicationBootstrap, DIContainer, NitroStackServer } from '@nitrostack/core';
import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../services/health.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware.js';
import { errorMiddleware } from '../middleware/error.middleware.js';

interface ExpressLayer {
  name: string;
  route?: { path: string; methods: Record<string, boolean> };
  handle: (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Safely send a JSON response whether res is decorated by Express or raw http.ServerResponse.
 */
function sendJson(res: Response | any, code: number, data: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(code).json(data);
  } else {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  }
}

/**
 * HttpSetupService
 * 
 * Configures the Express pipeline on StreamableHttpTransport:
 * - Public GET /health probe returning live database latency and HTTP 503 when down.
 * - Public GET / informational service index.
 * - Enforces Bearer token authentication boundary on /mcp before protocol dispatching.
 * - Rate limiting against DoS attacks.
 * - Global error handling boundary preventing credential/SQL leakage.
 */
@Injectable({ deps: [HealthService] })
export class HttpSetupService implements OnApplicationBootstrap {
  constructor(private readonly healthService: HealthService) {}

  async onApplicationBootstrap(): Promise<void> {
    const server = DIContainer.getInstance().resolve<NitroStackServer>(NitroStackServer);
    const transport = server.getHttpTransport();
    const app = transport?.getApp?.();

    if (!app || !(app as any)._router) {
      console.warn('⚠️  HttpSetupService: Express router not found on HTTP transport.');
      return;
    }

    console.log('🛡️  Configuring HTTP middleware, authentication, and /health endpoints on Streamable HTTP transport...');

    const router = (app as any)._router;
    const initialStackLength = router.stack.length;

    // 1. In-memory rate limiting
    app.use(rateLimitMiddleware);

    // 2. Public Health Check Endpoint (GET /health)
    app.get('/health', async (_req: Request, res: Response) => {
      try {
        const status = await this.healthService.getSystemStatus();
        const httpCode = status.isHealthy ? 200 : 503;
        sendJson(res, httpCode, {
          status: status.status,
          timestamp: status.timestamp,
          uptimeSeconds: status.uptimeSeconds,
          environment: status.environment,
          transport: status.transport,
          service: status.service,
          database: status.database,
          system: status.system,
        });
      } catch (err) {
        sendJson(res, 503, {
          status: 'UNHEALTHY',
          error: 'Health check probe failed',
        });
      }
    });

    // 3. Public Service Root Index (GET /)
    app.get('/', (_req: Request, res: Response) => {
      sendJson(res, 200, {
        name: 'class1-neon-mcp-server',
        version: '1.0.0',
        description: 'Class1Dev Pre-Merge AI Cost & Persistent Record MCP Server',
        status: 'RUNNING',
        transport: 'streamable-http',
        endpoints: {
          mcp: '/mcp',
          health: '/health',
        },
      });
    });

    // 4. Enforce Authentication on /mcp, /sse, and /mcp/messages
    app.use('/mcp', authMiddleware);
    app.use('/sse', authMiddleware);

    // Extract the newly added layers
    const newLayers: ExpressLayer[] = router.stack.splice(initialStackLength);

    // Find expressInit layer so we always stay AFTER expressInit
    const expressInitIndex = router.stack.findIndex((layer: ExpressLayer) => layer.name === 'expressInit');

    // Find the first /mcp route handler in the existing stack
    const mcpRouteIndex = router.stack.findIndex((layer: ExpressLayer) => 
      layer.route && (layer.route.path === '/mcp' || layer.route.path === '/sse')
    );

    // Insert our security, health, and auth layers immediately BEFORE the /mcp protocol routes,
    // but strictly AFTER expressInit
    const targetIndex = mcpRouteIndex !== -1 ? mcpRouteIndex : Math.max(expressInitIndex + 1, 0);
    router.stack.splice(targetIndex, 0, ...newLayers);

    // 5. Centralized error boundary - attach after all routes are registered
    setImmediate(() => {
      app.use(errorMiddleware);
    });

    console.log('✅ Streamable HTTP transport configured: /health (public), / (public), /mcp (Bearer auth enforced).');
  }
}
