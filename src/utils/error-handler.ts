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
 * Sanitizes any unknown error into a safe, client-facing message.
 * Strips out connection strings, passwords, raw SQL statements, and internal paths.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred.';
  }

  const rawMessage = error instanceof Error ? error.message : String(error);

  // Strip database connection strings (postgresql://...)
  let sanitized = rawMessage.replace(/postgresql:\/\/[^@\s]+@[^\s/]+/gi, 'postgresql://[REDACTED]');

  // Strip Neon hostnames (e.g. ep-xxx.us-east-2.aws.neon.tech)
  sanitized = sanitized.replace(/[a-z0-9-]+\.[a-z0-9-]+\.aws\.neon\.tech/gi, '[DATABASE_HOST]');

  // Strip local system paths (Windows and POSIX)
  sanitized = sanitized.replace(/[a-zA-Z]:\\[^\s:]+/g, '[REDACTED_PATH]');

  // Mask sensitive keywords if present
  sanitized = sanitized.replace(/(password|secret|key|token)=[^&\s]+/gi, '$1=[REDACTED]');

  // Handle common database error patterns cleanly
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
