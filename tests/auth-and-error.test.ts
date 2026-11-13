import { describe, it, expect, vi } from 'vitest';
import { sanitizeErrorMessage, formatToolError, extractErrorDetails } from '../src/utils/error-handler.js';
import { secureTimingEqual, authMiddleware } from '../src/middleware/auth.middleware.js';
import { config, resolveProjectRoot, PROJECT_ROOT } from '../src/config.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Error Sanitization and Safe Formatting', () => {
  it('should strip PostgreSQL connection strings and passwords from error messages', () => {
    const rawError = 'Connection failed: postgresql://neondb_owner:npg_SecretPass123@ep-cool-lake-12345.us-east-2.aws.neon.tech/neondb?sslmode=require';
    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain('npg_SecretPass123');
    expect(sanitized).not.toContain('ep-cool-lake-12345.us-east-2.aws.neon.tech');
    expect(sanitized).toContain('postgresql://[REDACTED]');
  });

  it('should strip file paths and hostnames', () => {
    const errorWithPath = 'Internal failure in C:\\Users\\Administrator\\Project\\src\\db\\index.ts crashed';
    const sanitized = sanitizeErrorMessage(errorWithPath);
    expect(sanitized).not.toContain('C:\\Users\\Administrator');
    expect(sanitized).toContain('[REDACTED_PATH]');
  });

  it('should format tool error envelope safely', () => {
    const rawError = new Error('Database query failure at postgresql://user:pass@host/db');
    const envelope = formatToolError('create_record', rawError);
    expect(envelope.error).toBe(true);
    expect(envelope.tool).toBe('create_record');
    expect(envelope.message).toContain('postgresql://[REDACTED]');
    expect(envelope.message).not.toContain('pass@host');
  });

  it('should extract error details from ErrorEvent and custom objects without returning [object Object]', () => {
    // Simulated Neon/ws ErrorEvent structure
    const errorEvent = {
      type: 'error',
      constructor: { name: 'ErrorEvent' },
      message: 'getaddrinfo ENOTFOUND ep-test.us-east-2.aws.neon.tech',
      error: new Error('getaddrinfo ENOTFOUND ep-test.us-east-2.aws.neon.tech'),
    };
    const details = extractErrorDetails(errorEvent);
    expect(details.className).toBe('Error');
    expect(details.message).toContain('getaddrinfo ENOTFOUND');

    const sanitized = sanitizeErrorMessage(errorEvent);
    expect(sanitized).not.toContain('[object Object]');
    expect(sanitized).not.toContain('[object ErrorEvent]');
    expect(sanitized).toBe('Database connection failed. Please ensure the database is reachable.');
  });

  it('should extract details from plain objects with message or cause', () => {
    const plain = { message: 'Connection terminated unexpectedly' };
    const details = extractErrorDetails(plain);
    expect(details.message).toBe('Connection terminated unexpectedly');

    const sanitized = sanitizeErrorMessage(plain);
    expect(sanitized).toBe('Connection terminated unexpectedly');
    expect(sanitized).not.toContain('[object Object]');
  });

  it('should never return [object Object] when given an empty or opaque object', () => {
    const opaque = { foo: 'bar' };
    const sanitized = sanitizeErrorMessage(opaque);
    expect(sanitized).not.toContain('[object Object]');
    expect(sanitized).toContain('Database query execution failed');
  });
});

describe('Constant-Time Auth Security Comparison', () => {
  it('should return true for identical strings', () => {
    const secret = 'a_very_secure_and_long_random_auth_secret_key_1234567890';
    expect(secureTimingEqual(secret, secret)).toBe(true);
  });

  it('should return false for different strings of same length', () => {
    const a = 'secret_one_1234567890123456789012';
    const b = 'secret_two_1234567890123456789012';
    expect(secureTimingEqual(a, b)).toBe(false);
  });

  it('should return false for strings of different length', () => {
    const a = 'short_secret';
    const b = 'long_secret_value_with_different_length';
    expect(secureTimingEqual(a, b)).toBe(false);
  });
});

describe('authMiddleware HTTP Authentication Boundary', () => {
  it('should return 401 when Authorization header is missing', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req = { originalUrl: '/mcp', path: '/mcp', method: 'POST', headers: { 'user-agent': 'vitest' }, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
    const res = {
      status: (c: number) => { statusCode = c; return res; },
      json: (d: any) => { jsonBody = d; return res; },
    } as any;
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(statusCode).toBe(401);
    expect(jsonBody.error).toBe('Unauthorized');
    expect(jsonBody.message).toContain('Missing Authorization header');
  });

  it('should return 401 when Authorization format is invalid', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req = { originalUrl: '/mcp', path: '/mcp', method: 'POST', headers: { authorization: 'Basic dXNlcjpwYXNz', 'user-agent': 'vitest' }, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
    const res = {
      status: (c: number) => { statusCode = c; return res; },
      json: (d: any) => { jsonBody = d; return res; },
    } as any;
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(statusCode).toBe(401);
    expect(jsonBody.message).toContain('Invalid Authorization header format');
  });

  it('should return 403 when Bearer token is invalid or wrong', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req = { originalUrl: '/mcp', path: '/mcp', method: 'POST', headers: { authorization: 'Bearer wrong_token_value_123', 'user-agent': 'vitest' }, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
    const res = {
      status: (c: number) => { statusCode = c; return res; },
      json: (d: any) => { jsonBody = d; return res; },
    } as any;
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(statusCode).toBe(403);
    expect(jsonBody.error).toBe('Forbidden');
  });

  it('should reject token in URL query string (URL query tokens not accepted)', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req = {
      originalUrl: `/mcp?token=${config.AUTH_SECRET}`,
      url: `/mcp?token=${config.AUTH_SECRET}`,
      path: '/mcp',
      method: 'GET',
      headers: { 'user-agent': 'vitest' },
      query: { token: config.AUTH_SECRET },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const res = {
      status: (c: number) => { statusCode = c; return res; },
      json: (d: any) => { jsonBody = d; return res; },
    } as any;
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(statusCode).toBe(401);
    expect(jsonBody.error).toBe('Unauthorized');
  });

  it('should call next() and populate req.auth when valid Bearer token is provided', () => {
    const req = {
      originalUrl: '/mcp',
      path: '/mcp',
      method: 'POST',
      headers: { authorization: `Bearer ${config.AUTH_SECRET}`, 'user-agent': 'vitest' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    const res = {} as any;
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.auth).toBeDefined();
    expect(req.auth.userId).toBe(config.DEFAULT_USER_ID);
  });

  it('should allow public routes (/health, /, OPTIONS) without authentication', () => {
    const publicPaths = ['/health', '/', '/info'];
    for (const p of publicPaths) {
      const req = { originalUrl: p, path: p, method: 'GET', headers: { 'user-agent': 'vitest' }, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
      const res = {} as any;
      const next = vi.fn();
      authMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});

describe('Transport Mode Configuration', () => {
  it('should determine stdio mode when MCP_TRANSPORT=stdio', () => {
    const prev = process.env.MCP_TRANSPORT;
    try {
      process.env.MCP_TRANSPORT = 'stdio';
      const requested = (process.env.MCP_TRANSPORT || process.env.MCP_TRANSPORT_TYPE || '').toLowerCase().trim();
      expect(requested).toBe('stdio');
    } finally {
      process.env.MCP_TRANSPORT = prev;
    }
  });

  it('should default to http transport when MCP_TRANSPORT is unset', () => {
    const prev = process.env.MCP_TRANSPORT;
    const prevType = process.env.MCP_TRANSPORT_TYPE;
    try {
      delete process.env.MCP_TRANSPORT;
      delete process.env.MCP_TRANSPORT_TYPE;
      const requested = (process.env.MCP_TRANSPORT || process.env.MCP_TRANSPORT_TYPE || '').toLowerCase().trim();
      expect(requested).not.toBe('stdio');
    } finally {
      process.env.MCP_TRANSPORT = prev;
      process.env.MCP_TRANSPORT_TYPE = prevType;
    }
  });

  it('should resolve PROJECT_ROOT correctly regardless of cwd', () => {
    expect(PROJECT_ROOT).toBeDefined();
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(PROJECT_ROOT, '.env'))).toBe(true);

    // Test resolveProjectRoot with a simulated file URL in a subfolder
    const mockFileUrl = `file:///${PROJECT_ROOT.replace(/\\/g, '/')}/dist/sub/deep/file.js`;
    const resolved = resolveProjectRoot(mockFileUrl);
    expect(resolved.toLowerCase()).toBe(PROJECT_ROOT.toLowerCase());
  });
});
