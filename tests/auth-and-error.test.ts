import { describe, it, expect } from 'vitest';
import { sanitizeErrorMessage, formatToolError } from '../src/utils/error-handler.js';
import { secureTimingEqual } from '../src/middleware/auth.middleware.js';

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
