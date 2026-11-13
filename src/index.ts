/**
 * Class1Dev MCP Server Entry Point
 * 
 * Powered by NitroStack TypeScript SDK (@nitrostack/core) and Neon PostgreSQL.
 * Bootstraps the application via McpApplicationFactory with standard Streamable HTTP transport:
 * - Transport: Streamable HTTP on POST /mcp with Bearer token authentication
 * - Telemetry & Probing: GET /health and GET /
 * - Binding: Defaults to 127.0.0.1 (overridable via HOST env var)
 * - Protocol Era: 'legacy' (2025-06-18) is strictly REQUIRED. When omitted, @nitrostack/core
 *   switches to 'modern (2026-07-28)' which rejects Zod object schemas with:
 *   "Modern MCP handler error: inputSchema/outputSchema/argsSchema must be a Standard Schema"
 *   and causes POST /mcp initialize to return HTTP 500.
 */

import 'dotenv/config';

// Strictly required by @nitrostack/core to support standard Zod schemas over JSON-RPC 2.0
if (!process.env.NITRO_MCP_PROTOCOL_VERSION) {
  process.env.NITRO_MCP_PROTOCOL_VERSION = 'legacy';
}

import { McpApplicationFactory } from '@nitrostack/core';
import { AppModule } from './app.module.js';
import { config } from './config.js';

/**
 * Bootstrap the Class1Dev MCP application
 */
async function bootstrap() {
  const requestedTransport = (process.env.MCP_TRANSPORT || process.env.MCP_TRANSPORT_TYPE || '').toLowerCase().trim();
  const isStdio = requestedTransport === 'stdio';

  if (isStdio) {
    // In STDIO mode, stdout is reserved EXCLUSIVELY for JSON-RPC 2.0 protocol messages.
    // Redirect console.log to console.error (stderr) so any diagnostic messages never corrupt stdout.
    console.log = (...args: any[]) => console.error(...args);
  }

  const server = await McpApplicationFactory.create(AppModule);

  if (isStdio) {
    await server.start({
      transport: 'stdio',
    });
  } else {
    await server.start({
      transport: 'http',
      port: config.PORT,
      host: config.HOST,
    });
  }
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start Class1Dev MCP server:', error);
  process.exit(1);
});
