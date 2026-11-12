import { describe, it, expect } from 'vitest';
import {
  CreateRecordSchema,
  GetRecordSchema,
  ListRecordsSchema,
  UpdateRecordSchema,
  DeleteRecordSchema,
  SearchRecordsSchema,
} from '../src/tools/schemas.js';

describe('MCP Tool Schema Validation', () => {
  it('should validate valid create_record input', () => {
    const valid = {
      title: 'Production Incident #402',
      description: 'API gateway timeout investigation',
      metadata: { severity: 'high', tags: ['incident', 'api'] },
    };
    const parsed = CreateRecordSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('should reject create_record with empty title', () => {
    const invalid = {
      title: '',
    };
    const parsed = CreateRecordSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('should enforce UUID format on get_record', () => {
    const valid = { id: '123e4567-e89b-12d3-a456-426614174000' };
    const invalid = { id: 'not-a-valid-uuid' };

    expect(GetRecordSchema.safeParse(valid).success).toBe(true);
    expect(GetRecordSchema.safeParse(invalid).success).toBe(false);
  });

  it('should clamp and default pagination on list_records', () => {
    const parsed = ListRecordsSchema.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);

    const custom = ListRecordsSchema.parse({ limit: 50, offset: 10 });
    expect(custom.limit).toBe(50);
    expect(custom.offset).toBe(10);
  });

  it('should enforce UUID on update_record and allow partial fields', () => {
    const valid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Updated Title',
    };
    expect(UpdateRecordSchema.safeParse(valid).success).toBe(true);
  });

  it('should enforce UUID on delete_record', () => {
    const valid = { id: '123e4567-e89b-12d3-a456-426614174000' };
    const invalid = { id: '12345' };

    expect(DeleteRecordSchema.safeParse(valid).success).toBe(true);
    expect(DeleteRecordSchema.safeParse(invalid).success).toBe(false);
  });

  it('should reject search_records with empty query', () => {
    const emptyQuery = { query: '' };
    expect(SearchRecordsSchema.safeParse(emptyQuery).success).toBe(false);

    const validQuery = { query: 'incident' };
    expect(SearchRecordsSchema.safeParse(validQuery).success).toBe(true);
  });
});

