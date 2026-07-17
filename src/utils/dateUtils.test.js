import { describe, it, expect } from 'vitest';
import { buildDateKey, parseDateKey } from './dateUtils';

describe('dateUtils', () => {
  describe('buildDateKey', () => {
    it('formats a regular date correctly', () => {
      // Month is 0-indexed in JS, so 11 is December
      expect(buildDateKey(2023, 11, 25)).toBe('2023-12-25');
    });

    it('pads single-digit months and days with leading zero', () => {
      // Month 4 is May
      expect(buildDateKey(2024, 4, 9)).toBe('2024-05-09');
    });

    it('handles start of year correctly', () => {
      // Month 0 is January
      expect(buildDateKey(2020, 0, 1)).toBe('2020-01-01');
    });
  });

  describe('parseDateKey', () => {
    it('parses a valid date key back to numbers', () => {
      expect(parseDateKey('2023-12-25')).toEqual({
        year: 2023,
        month: 11,
        day: 25,
      });
    });

    it('parses zero-padded dates correctly', () => {
      expect(parseDateKey('2024-05-09')).toEqual({
        year: 2024,
        month: 4,
        day: 9,
      });
    });

    it('returns null for invalid strings with missing parts', () => {
      expect(parseDateKey('2023-12')).toBeNull();
      expect(parseDateKey('2023')).toBeNull();
      expect(parseDateKey('')).toBeNull();
    });

    it('returns null for strings containing non-numeric parts', () => {
      expect(parseDateKey('2023-12-ab')).toBeNull();
      expect(parseDateKey('invalid')).toBeNull();
    });
  });
});
