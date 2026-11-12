/**
 * Class1Dev MCP Server Entry Point
 * 
 * Powered by NitroStack TypeScript SDK (@nitrostack/core) and Neon PostgreSQL.
 * Bootstraps the application via McpApplicationFactory with standard Streamable HTTP transport:
 * - Transport: Streamable HTTP on POST /mcp with Bearer token authentication
 * - Telemetry & Probing: GET /health and GET /
 * - Protocol Era: 'legacy' (2025-06-18) is enforced to ensure 100% compatibility
 *   with standard MCP clients, Claude Code, Cursor, and the official MCP Inspector,
 *   which rely on the standard JSON-RPC 2.0 'initialize' handshake and session semantics.
 */

import 'dotenv/config';

// Ensure 100% compatibility with standard MCP clients and official MCP SDK
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
  const server = await McpApplicationFactory.create(AppModule);
  await server.start({
    transport: 'http',
    port: config.PORT,
    host: '0.0.0.0',
  });
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start Class1Dev MCP server:', error);
  process.exit(1);
});
