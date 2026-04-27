import { describe, expect, it } from 'vitest';
import { arrowPath, isKnightJump, squareCenter } from '../arrowGeometry';

describe('squareCenter', () => {
  it('places a1 at the bottom-left in white orientation', () => {
    const p = squareCenter('a1', 'white');
    // Cell size is 12.5%; centre of bottom-left = (6.25, 93.75).
    expect(p.x).toBeCloseTo(6.25, 2);
    expect(p.y).toBeCloseTo(93.75, 2);
  });

  it('places h8 at the top-right in white orientation', () => {
    const p = squareCenter('h8', 'white');
    expect(p.x).toBeCloseTo(93.75, 2);
    expect(p.y).toBeCloseTo(6.25, 2);
  });

  it('flips both axes in black orientation', () => {
    const p = squareCenter('a1', 'black');
    expect(p.x).toBeCloseTo(93.75, 2);
    expect(p.y).toBeCloseTo(6.25, 2);
  });
});

describe('isKnightJump', () => {
  it('detects all eight knight jumps from b1', () => {
    expect(isKnightJump('b1', 'a3')).toBe(true);
    expect(isKnightJump('b1', 'c3')).toBe(true);
    expect(isKnightJump('b1', 'd2')).toBe(true);
  });

  it('rejects non-knight moves', () => {
    expect(isKnightJump('e2', 'e4')).toBe(false);
    expect(isKnightJump('a1', 'h8')).toBe(false);
    expect(isKnightJump('a1', 'b1')).toBe(false);
  });
});

describe('arrowPath', () => {
  it('produces a single-segment line for non-knight arrows', () => {
    const { d } = arrowPath('e2', 'e4', 'white');
    // Two M+L pairs would mean a corner; we expect just one L command.
    const lCount = (d.match(/L /g) ?? []).length;
    expect(lCount).toBe(1);
  });

  it('produces an L-shape (two segments) for knight jumps', () => {
    const { d } = arrowPath('g1', 'f3', 'white');
    const lCount = (d.match(/L /g) ?? []).length;
    expect(lCount).toBe(2);
  });

  it('routes the knight long leg along the larger displacement', () => {
    // g1 → f3: |dx|=1, |dy|=2 → long leg along Y → corner shares from.x.
    const { d } = arrowPath('g1', 'f3', 'white');
    const start = squareCenter('g1', 'white');
    // First L token's coordinates are the corner.
    const cornerMatch = d.match(/L ([\d.-]+) ([\d.-]+)/);
    expect(cornerMatch).not.toBeNull();
    const cornerX = Number(cornerMatch?.[1]);
    expect(cornerX).toBeCloseTo(start.x, 2);
  });

  it('flips knight corner placement when |dx| > |dy|', () => {
    // a1 → c2: |dx|=2, |dy|=1 → long leg along X → corner shares from.y.
    const { d } = arrowPath('a1', 'c2', 'white');
    const start = squareCenter('a1', 'white');
    const cornerMatch = d.match(/L ([\d.-]+) ([\d.-]+)/);
    const cornerY = Number(cornerMatch?.[2]);
    expect(cornerY).toBeCloseTo(start.y, 2);
  });

  it('emits a positive stroke width', () => {
    const { strokeWidth } = arrowPath('e2', 'e4', 'white');
    expect(strokeWidth).toBeGreaterThan(0);
  });

  it('respects orientation for endpoint placement', () => {
    const dWhite = arrowPath('e2', 'e4', 'white').d;
    const dBlack = arrowPath('e2', 'e4', 'black').d;
    // Different orientations push the endpoints to different SVG coords.
    expect(dWhite).not.toBe(dBlack);
  });
});
