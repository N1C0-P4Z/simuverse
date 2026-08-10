import { describe, it, expect } from 'vitest';
import { ALLOWED_EXTENSIONS, MIME_MAP } from '../file-upload';

describe('file-upload constants', () => {
  it('ALLOWED_EXTENSIONS contains exactly the 6 expected extensions', () => {
    expect(ALLOWED_EXTENSIONS).toEqual(
      expect.arrayContaining(['.xls', '.xlsx', '.csv', '.pdf', '.doc', '.docx']),
    );
    expect(ALLOWED_EXTENSIONS).toHaveLength(6);
  });

  it('MIME_MAP covers every allowed extension', () => {
    for (const ext of ALLOWED_EXTENSIONS) {
      expect(MIME_MAP[ext]).toBeDefined();
      expect(typeof MIME_MAP[ext]).toBe('string');
      expect(MIME_MAP[ext].length).toBeGreaterThan(0);
    }
  });

  it('MIME_MAP has no extra keys beyond ALLOWED_EXTENSIONS', () => {
    expect(Object.keys(MIME_MAP).sort()).toEqual([...ALLOWED_EXTENSIONS].sort());
  });
});
