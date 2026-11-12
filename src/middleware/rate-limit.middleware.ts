import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60 * 1000; // 1 minute

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 30 * 1000).unref();

/**
 * Lightweight in-memory rate limiting middleware for DoS protection.
 * - Exempts GET /health diagnostic probes.
 * - Exempts OPTIONS preflight calls.
 * - Strictly protects /mcp and all mutation routes.
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 1. Exempt OPTIONS preflight and public /health probes
  const targetPath = (req.originalUrl || req.path || '').split('?')[0];
  if (req.method === 'OPTIONS' || targetPath === '/health') {
    return next();
  }

  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '', 10) || 60;
  const clientKey = req.ip || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown-client';
  const now = Date.now();

  const entry = rateLimitMap.get(clientKey);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientKey, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
    res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded on ${targetPath || '/mcp'}. Please try again later.`,
    });
    return;
  }

  next();
}
