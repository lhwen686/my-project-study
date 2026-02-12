import { describe, expect, it } from 'vitest';

import { calculateSm2 } from './sm2';

describe('SM-2 boundary conditions', () => {
  it('quality=3 still counts as correct branch', () => {
    const next = calculateSm2({ repetition: 0, intervalDays: 0, easeFactor: 2.5 }, 3, new Date('2026-01-01T00:00:00.000Z'));
    expect(next.repetition).toBe(1);
    expect(next.intervalDays).toBe(1);
  });

  it('interval keeps minimum 1 on low quality reset', () => {
    const next = calculateSm2({ repetition: 10, intervalDays: 90, easeFactor: 2.6 }, 0, new Date('2026-01-01T00:00:00.000Z'));
    expect(next.intervalDays).toBe(1);
    expect(next.repetition).toBe(0);
  });

  it('invalid negative quality throws', () => {
    expect(() => calculateSm2({ repetition: 0, intervalDays: 0, easeFactor: 2.5 }, -1)).toThrow();
  });
});
