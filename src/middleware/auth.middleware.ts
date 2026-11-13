import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

/**
 * Constant-time string equality comparison to prevent timing attacks.
 */
export function secureTimingEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    // Perform dummy timing comparison on bufA to maintain constant execution time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Helper: Records an unauthorized attempt in Neon PostgreSQL audit_logs.
 * Fire-and-forget: audit failures must never crash the HTTP pipeline.
 */
async function logUnauthorizedAttempt(req: Request, reason: string) {
  try {
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    await db.insert(auditLogs).values({
      userId: null,
      toolName: 'auth_boundary',
      action: 'AUTHENTICATE',
      status: 'UNAUTHORIZED',
      metadata: {
        path: req.originalUrl || req.path,
        method: req.method,
        reason,
        clientIp,
        userAgent: req.headers['user-agent'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    // Non-fatal: do not crash if database is temporarily unavailable during auth check
    console.error('⚠️  Failed to record unauthorized audit log:', err);
  }
}

/**
 * Safely send a JSON response whether res is decorated by Express or raw http.ServerResponse.
 */
function sendJsonResponse(res: Response, code: number, data: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(code).json(data);
  } else {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  }
}

/**
 * Authentication Middleware
 * Enforces Bearer token authentication on protected MCP routes.
 * /health and / are public.
 * All requests to /mcp require Authorization: Bearer <AUTH_SECRET>.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use originalUrl to get the full request URL before Express sub-mount prefix stripping
  const rawPath = req.originalUrl || req.url || req.path || '';
  const fullPath = rawPath.split('?')[0];

  // Allow health, root documentation, and OPTIONS preflight requests without authentication
  if (
    req.method === 'OPTIONS' ||
    fullPath === '/' ||
    fullPath === '/health' ||
    fullPath === '/info' ||
    fullPath.endsWith('/health')
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    void logUnauthorizedAttempt(req, 'Missing Authorization header');
    sendJsonResponse(res, 401, {
      error: 'Unauthorized',
      message: 'Missing Authorization header. Please provide Bearer <token>.',
    });
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    void logUnauthorizedAttempt(req, 'Invalid Authorization header format');
    sendJsonResponse(res, 401, {
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected format: Bearer <token>.',
    });
    return;
  }

  const token = parts[1];
  if (!secureTimingEqual(token, config.AUTH_SECRET)) {
    void logUnauthorizedAttempt(req, 'Invalid bearer token');
    sendJsonResponse(res, 403, {
      error: 'Forbidden',
      message: 'Provided authentication token is invalid or expired.',
    });
    return;
  }

  // Populate auth details for downstream session context
  (req as any).auth = {
    userId: config.DEFAULT_USER_ID,
    tenantId: config.DEFAULT_USER_ID,
  };

  next();
}
