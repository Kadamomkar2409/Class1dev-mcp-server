/**
 * NitroStack Configuration for Class1Dev Local MCP Server
 * 
 * Configures build parameters, local Streamable HTTP transport bound to 127.0.0.1,
 * and restricted CORS for local development.
 */
export default {
  name: 'class1-neon-mcp-server',
  version: '1.0.0',
  description: 'Class1Dev Pre-Merge AI Cost & Persistent Record MCP Server',
  entry: './src/index.ts',
  build: {
    target: 'node22',
    outDir: './dist',
    sourcemap: true,
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    host: process.env.HOST || '127.0.0.1',
    transports: ['http'],
    cors: {
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
      ],
    },
  },
};
