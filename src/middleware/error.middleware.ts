import { Request, Response, NextFunction } from 'express';
import { sanitizeErrorMessage } from '../utils/error-handler.js';

/**
 * Global Express Error Boundary Middleware
 * Catches all unhandled exceptions and prevents information leakage (credentials, SQL, internal paths).
 */
export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction): void {
  let status = 500;
  if (err?.type === 'entity.too.large' || err?.status === 413 || err?.statusCode === 413) {
    status = 413;
  } else if (typeof err?.status === 'number' && err.status >= 400 && err.status < 600) {
    status = err.status;
  } else if (typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600) {
    status = err.statusCode;
  }

  const safeMessage = sanitizeErrorMessage(err);

  let errorTitle = 'Internal Server Error';
  let clientMessage = safeMessage;

  if (status === 413) {
    errorTitle = 'Payload Too Large';
    clientMessage = 'Request payload exceeds maximum allowed size limit (1 MB).';
  } else if (status === 400) {
    errorTitle = 'Bad Request';
    clientMessage = safeMessage.includes('Invalid') ? safeMessage : 'Invalid request payload or malformed JSON received.';
  } else if (status === 401) {
    errorTitle = 'Unauthorized';
  } else if (status === 403) {
    errorTitle = 'Forbidden';
  } else if (status === 404) {
    errorTitle = 'Not Found';
  } else if (status === 429) {
    errorTitle = 'Too Many Requests';
  }

  const payload = {
    error: errorTitle,
    message: clientMessage,
  };

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(payload);
  } else {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  }
}
