import { describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({
  ensureDatabaseReady: vi.fn(async () => undefined),
  getDatabase: vi.fn(() => ({
    get: vi.fn(),
    all: vi.fn(),
  })),
}));

import { parseOptionalJson } from './export';

describe('export_json_parsing_spec', () => {
  it('returns_null_for_malformed_json_payloads', () => {
    expect(parseOptionalJson('{"consensus":')).toBeNull();
  });

  it('returns_parsed_value_for_valid_json_payloads', () => {
    expect(parseOptionalJson<{ consensus: string }>(JSON.stringify({ consensus: 'Aligned' }))).toEqual({
      consensus: 'Aligned',
    });
  });
});
