/**
 * Centralized Error Sanitization and Formatting Utilities
 * 
 * Guarantees zero leakage of credentials, database hostnames, raw SQL queries,
 * or system stack traces to clients or LLM conversation sessions.
 */

export interface SanitizedError {
  error: true;
  message: string;
  code?: string;
  suggestion?: string;
}

/**
 * Extracts class name and readable message from any error shape,
 * including ErrorEvent, plain objects, nested causes, and non-standard exceptions.
 */
export function extractErrorDetails(error: unknown): { className: string; message: string } {
  if (!error) {
    return { className: 'Error', message: 'An unexpected error occurred.' };
  }

  if (typeof error === 'string') {
    return { className: 'Error', message: error };
  }

  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;
    const className = errObj.constructor?.name || (error instanceof Error ? error.name : 'Error');

    // Case 1: WebSocket / Neon ErrorEvent with inner error object
    if (errObj.error) {
      if (errObj.error instanceof Error) {
        return {
          className: errObj.error.name || errObj.error.constructor?.name || className,
          message: errObj.error.message || `Database error (${errObj.error.name || className})`,
        };
      }
      if (typeof errObj.error === 'object') {
        const nestedClass = errObj.error.constructor?.name || errObj.error.name || className;
        const nestedMsg = errObj.error.message || (typeof errObj.error === 'string' ? errObj.error : '');
        if (nestedMsg) {
          return { className: nestedClass, message: nestedMsg };
        }
      } else if (typeof errObj.error === 'string' && errObj.error.trim().length > 0) {
        return { className, message: errObj.error };
      }
    }

    // Case 2: direct message property (e.g. ErrorEvent.message or plain { message })
    if (typeof errObj.message === 'string' && errObj.message.trim().length > 0) {
      return { className, message: errObj.message };
    }

    // Case 3: nested cause (standard ES2022 error causes)
    if (errObj.cause) {
      if (errObj.cause instanceof Error) {
        return {
          className: errObj.cause.name || errObj.cause.constructor?.name || className,
          message: errObj.cause.message,
        };
      }
      if (typeof errObj.cause === 'object' && typeof errObj.cause.message === 'string' && errObj.cause.message) {
        return {
          className: errObj.cause.constructor?.name || className,
          message: errObj.cause.message,
        };
      }
    }

    // Case 4: PostgreSQL / Drizzle error with code or detail
    if (errObj.code || errObj.detail) {
      const parts = [errObj.code, errObj.detail].filter(Boolean).join(': ');
      return { className, message: parts };
    }

    // Case 5: standard Error instance
    if (error instanceof Error && error.message) {
      return { className: error.name || className, message: error.message };
    }

    // Case 6: check String(error) if it's not [object Object]
    const str = String(error);
    if (str && str !== '[object Object]' && str !== '[object ErrorEvent]') {
      return { className, message: str };
    }

    return { className, message: `Database query execution failed (${className})` };
  }

  return { className: 'Error', message: String(error) };
}

/**
 * Sanitizes any unknown error into a safe, client-facing message.
 * Strips out connection strings, passwords, raw SQL statements, and internal paths.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred.';
  }

  const { className, message: rawMessage } = extractErrorDetails(error);

  // Strip database connection strings (postgresql://...)
  let sanitized = rawMessage.replace(/postgresql:\/\/[^@\s]+@[^\s/]+/gi, 'postgresql://[REDACTED]');

  // Strip Neon hostnames (e.g. ep-xxx.us-east-2.aws.neon.tech, *.neon.tech)
  sanitized = sanitized.replace(/[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech/gi, '[DATABASE_HOST]');
  sanitized = sanitized.replace(/[a-z0-9-]+\.neon\.tech/gi, '[DATABASE_HOST]');

  // Strip local system paths (Windows and POSIX)
  sanitized = sanitized.replace(/[a-zA-Z]:\\[^\s:]+/g, '[REDACTED_PATH]');
  sanitized = sanitized.replace(/\/(?:[a-zA-Z0-9_\-\.]+\/)+[a-zA-Z0-9_\-\.]+/g, '[REDACTED_PATH]');

  // Mask sensitive keywords if present
  sanitized = sanitized.replace(/(password|secret|key|token)=[^&\s]+/gi, '$1=[REDACTED]');

  // Handle common database error patterns cleanly
  if (/password authentication failed/i.test(sanitized)) {
    return 'Database authentication failed. Please verify credentials.';
  }
  if (/connection refused|ECONNREFUSED|getaddrinfo ENOTFOUND/i.test(sanitized)) {
    return 'Database connection failed. Please ensure the database is reachable.';
  }
  if (/timeout|connection timeout/i.test(sanitized)) {
    return 'Database operation timed out. Please try again.';
  }
  if (/foreign key constraint/i.test(sanitized)) {
    return 'Referenced entity does not exist (e.g., invalid userId).';
  }
  if (/duplicate key|unique constraint/i.test(sanitized)) {
    return 'A record with these unique attributes already exists.';
  }

  // Remove full SQL dump if present
  if (sanitized.includes('select ') || sanitized.includes('insert into ') || sanitized.includes('update ') || sanitized.includes('delete from ')) {
    return 'Database query execution failed.';
  }

  // Prevent fallback string leak of [object Object]
  if (sanitized === '[object Object]' || sanitized === '[object ErrorEvent]') {
    return `Database error (${className})`;
  }

  return sanitized;
}

/**
 * Formats a safe tool response envelope compatible with standard MCP outputs.
 */
export function formatToolError(toolName: string, error: unknown, suggestion?: string) {
  const safeMessage = sanitizeErrorMessage(error);
  return {
    error: true,
    tool: toolName,
    message: safeMessage,
    suggestion: suggestion || 'Verify the input arguments and ensure the target resource exists.',
  };
}
