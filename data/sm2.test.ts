import { describe, expect, it } from 'vitest';

import { calculateSm2 } from './sm2';

const BASE = new Date('2026-02-12T00:00:00.000Z');

describe('calculateSm2', () => {
  it('首次正确：新卡第一次答对后 interval=1, repetition=1', () => {
    const next = calculateSm2({ repetition: 0, intervalDays: 0, easeFactor: 2.5 }, 4, BASE);

    expect(next.repetition).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.dueDate).toBe('2026-02-13T00:00:00.000Z');
  });

  it('连续正确：第二次正确后 interval=6', () => {
    const next = calculateSm2({ repetition: 1, intervalDays: 1, easeFactor: 2.5 }, 5, BASE);

    expect(next.repetition).toBe(2);
    expect(next.intervalDays).toBe(6);
    expect(next.dueDate).toBe('2026-02-18T00:00:00.000Z');
  });

  it('连续正确：第三次正确后按 EF 扩展间隔', () => {
    const next = calculateSm2({ repetition: 2, intervalDays: 6, easeFactor: 2.5 }, 5, BASE);

    expect(next.repetition).toBe(3);
    expect(next.intervalDays).toBe(16);
    expect(next.dueDate).toBe('2026-02-28T00:00:00.000Z');
  });

  it('错误后重置：quality<3 时 repetition 重置且 interval=1', () => {
    const next = calculateSm2({ repetition: 4, intervalDays: 20, easeFactor: 2.2 }, 2, BASE);

    expect(next.repetition).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.dueDate).toBe('2026-02-13T00:00:00.000Z');
  });

  it('EF 下限：再差也不低于 1.3', () => {
    const next = calculateSm2({ repetition: 3, intervalDays: 10, easeFactor: 1.31 }, 0, BASE);

    expect(next.easeFactor).toBe(1.3);
  });

  it('参数校验：quality 超界抛错', () => {
    expect(() => calculateSm2({ repetition: 0, intervalDays: 0, easeFactor: 2.5 }, 6, BASE)).toThrow(
      /between 0 and 5/,
    );
  });
});
