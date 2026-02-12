import { describe, expect, it } from 'vitest';

import { createOcclusionAtPoint, pickRandomOcclusion, toAbsoluteRect } from './occlusion';

describe('occlusion helpers', () => {
  it('scales normalized rect to different screen sizes', () => {
    const rect = { x: 0.1, y: 0.2, width: 0.25, height: 0.3 };
    const small = toAbsoluteRect(rect, 200, 100);
    const big = toAbsoluteRect(rect, 400, 200);

    expect(small.left).toBe(20);
    expect(small.top).toBe(20);
    expect(big.left).toBe(40);
    expect(big.width).toBe(100);
  });

  it('random picker is deterministic with seeded input', () => {
    const rects = [
      { x: 0, y: 0, width: 0.2, height: 0.2, label: 'A' },
      { x: 0.3, y: 0.3, width: 0.2, height: 0.2, label: 'B' },
      { x: 0.6, y: 0.6, width: 0.2, height: 0.2, label: 'C' },
    ];
    expect(pickRandomOcclusion(rects, 0.01)?.label).toBe('A');
    expect(pickRandomOcclusion(rects, 0.45)?.label).toBe('B');
    expect(pickRandomOcclusion(rects, 0.95)?.label).toBe('C');
  });

  it('creates clickable occlusion centered near touch point', () => {
    const r = createOcclusionAtPoint(100, 50, 200, 100);
    expect(r.width).toBeGreaterThan(0.1);
    expect(r.height).toBeGreaterThan(0.1);
    expect(r.x).toBeGreaterThan(0.35);
    expect(r.y).toBeGreaterThan(0.35);
  });
});
