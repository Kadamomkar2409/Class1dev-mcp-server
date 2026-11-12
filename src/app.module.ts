import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { Class1Module } from './modules/class1/class1.module.js';
import { DatabaseHealthCheck } from './health/database.health.js';
import { HttpSetupService } from './modules/http-setup.service.js';
import { config } from './config.js';

/**
 * Root Application Module
 * Bootstraps the Class1Dev MCP Server powered by the NitroStack TypeScript SDK and Neon PostgreSQL.
 * Configured for standard Streamable HTTP transport on port 3000.
 */
@McpApp({
  module: AppModule,
  server: {
    name: 'class1-neon-mcp-server',
    version: '1.0.0',
  },
  transport: {
    type: 'http',
    http: {
      port: config.PORT,
      host: '0.0.0.0',
      basePath: '/mcp',
    },
  },
  logging: {
    level: 'info',
  },
})
@Module({
  name: 'app',
  description: 'NitroStack Class1Dev Pre-Merge AI Cost & Persistent Record MCP Server',
  imports: [
    ConfigModule.forRoot(),
    Class1Module,
  ],
  providers: [
    DatabaseHealthCheck,
    HttpSetupService,
  ],
})
export class AppModule {}
