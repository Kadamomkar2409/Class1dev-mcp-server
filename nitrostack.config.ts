/**
 * NitroStack Cloud & Platform Deployment Configuration for Class1Dev
 * 
 * Configures build parameters, Streamable HTTP transport on port 3000,
 * and container runtime targets.
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
    transports: ['http'],
    cors: {
      origin: '*',
    },
  },
  cloud: {
    region: 'us-central1',
    autoScale: true,
    minInstances: 1,
    maxInstances: 10,
  },
};
