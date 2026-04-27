import { describe, expect, it } from 'vitest';
import { analyzePawnStructure } from '../pawnStructure';
import { Game } from '../../game';

describe('analyzePawnStructure', () => {
  it('returns empty buckets for the starting position (every pawn supported)', () => {
    const g = new Game();
    const w = analyzePawnStructure(g, 'w');
    expect(w.doubled).toHaveLength(0);
    expect(w.isolated).toHaveLength(0);
    expect(w.backward).toHaveLength(0);
    // Pawns at the start aren't passed — opposing pawns sit on the same file.
    expect(w.passed).toHaveLength(0);
  });

  it('flags doubled pawns', () => {
    // White pawns on d2 and d4 — both flagged as doubled.
    const g = Game.fromFen('4k3/8/8/8/3P4/8/3P4/4K3 w - - 0 1');
    const w = analyzePawnStructure(g, 'w');
    const doubledFiles = w.doubled.map((p) => p.square).sort();
    expect(doubledFiles).toEqual(['d2', 'd4']);
  });

  it('flags an isolated pawn (no friendly neighbours)', () => {
    // White pawns on a4 (isolated) and h4 (isolated). No b/g pawns.
    const g = Game.fromFen('4k3/8/8/8/P6P/8/8/4K3 w - - 0 1');
    const w = analyzePawnStructure(g, 'w');
    const isoFiles = w.isolated.map((p) => p.square).sort();
    expect(isoFiles).toEqual(['a4', 'h4']);
  });

  it('flags a passed pawn (no enemy pawns blocking ahead)', () => {
    // White pawn d5 with black pawns only on a-file. d-file and c/e have no
    // black pawns ahead → d5 is passed.
    const g = Game.fromFen('4k3/p7/8/3P4/8/8/8/4K3 w - - 0 1');
    const w = analyzePawnStructure(g, 'w');
    expect(w.passed.find((p) => p.square === 'd5')).toBeDefined();
  });

  it('does not flag a pawn as passed when a blocker is on the file ahead', () => {
    // White pawn d4 with black pawn d6 — d4 is not passed.
    const g = Game.fromFen('4k3/8/3p4/8/3P4/8/8/4K3 w - - 0 1');
    const w = analyzePawnStructure(g, 'w');
    expect(w.passed.find((p) => p.square === 'd4')).toBeUndefined();
  });

  it('does not flag a pawn as passed when an enemy pawn on an adjacent file is ahead', () => {
    // White pawn d4, black pawn c6 → c-pawn blocks d4 from being passed.
    const g = Game.fromFen('4k3/8/2p5/8/3P4/8/8/4K3 w - - 0 1');
    const w = analyzePawnStructure(g, 'w');
    expect(w.passed.find((p) => p.square === 'd4')).toBeUndefined();
  });

  it('flags a backward pawn', () => {
    // White pawn d3, friendly e4 / c4 (both ahead). Black pawn c5 attacks d4 —
    // wait, we want the push square (d4) attacked. Black pawns on c5 + e5
    // both attack d4. Adjacent friendly support is c4 / e4 (both AHEAD of
    // d3, not at-or-behind), so no support → backward.
    const g = Game.fromFen('4k3/8/8/2p1p3/2P1P3/3P4/8/4K3 w - - 0 1');
    const w = analyzePawnStructure(g, 'w');
    expect(w.backward.find((p) => p.square === 'd3')).toBeDefined();
  });

  it('mirrors the analysis for black', () => {
    // Black pawns on a5 (isolated) — black analysis.
    const g = Game.fromFen('4k3/8/8/p7/8/8/8/4K3 w - - 0 1');
    const b = analyzePawnStructure(g, 'b');
    expect(b.isolated.find((p) => p.square === 'a5')).toBeDefined();
  });
});
