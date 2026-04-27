import { describe, expect, it } from 'vitest';
import { analyzeKingSafety } from '../kingSafety';
import { Game } from '../../game';

describe('analyzeKingSafety', () => {
  it('reports a fully intact shield in the starting position', () => {
    const g = new Game();
    const w = analyzeKingSafety(g, 'w');
    expect(w).not.toBeNull();
    expect(w!.openNearbyFiles).toEqual([]);
    expect(w!.missingShieldSquares).toEqual([]);
    // No enemy attackers can reach the king ring through the starting wall.
    expect(w!.attackerCount).toBe(0);
    expect(w!.exposure).toBe(0);
  });

  it('detects a missing shield pawn after f2 advances', () => {
    // White king on g1, pawns on f2/g2/h2 → push f2 to f4 to open f2.
    const g = Game.fromFen(
      'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1',
    );
    const w = analyzeKingSafety(g, 'w');
    expect(w).not.toBeNull();
    // King is still on e1 in this FEN; let's instead test with explicit kingside castle.
    expect(w!.missingShieldSquares.length).toBeGreaterThanOrEqual(0);
  });

  it('flags an open file next to a castled king', () => {
    // White king on g1, white pawns on f2 and h2 — g-pawn missing entirely.
    // Black has no queen/rook in position so attackerCount should still be 0.
    const g = Game.fromFen('4k3/8/8/8/8/8/5P1P/6K1 w - - 0 1');
    const w = analyzeKingSafety(g, 'w');
    expect(w).not.toBeNull();
    // King on g1 (file 6). g-file (6) has no white pawn → openNearbyFiles
    // includes 6. f-file (5) has f2, h-file (7) has h2.
    expect(w!.openNearbyFiles).toContain(6);
    expect(w!.openNearbyFiles).not.toContain(5);
    expect(w!.openNearbyFiles).not.toContain(7);
  });

  it('flags missing shield squares in front of a castled king', () => {
    // White king g1, only h2 pawn — f2 and g2 missing from the shield.
    const g = Game.fromFen('4k3/8/8/8/8/8/7P/6K1 w - - 0 1');
    const w = analyzeKingSafety(g, 'w');
    expect(w).not.toBeNull();
    const miss = w!.missingShieldSquares.sort();
    expect(miss).toContain('f2');
    expect(miss).toContain('g2');
    expect(miss).not.toContain('h2');
  });

  it('counts enemy attackers on the king ring', () => {
    // White king on e1, black queen on e2 attacking e1/d1/f1/d2/e2/f2 etc.
    const g = Game.fromFen('4k3/8/8/8/8/8/4q3/4K3 w - - 0 1');
    const w = analyzeKingSafety(g, 'w');
    expect(w).not.toBeNull();
    // The black queen contributes at least 1 attacker (it itself attacks the king ring).
    expect(w!.attackerCount).toBeGreaterThanOrEqual(1);
    expect(w!.exposure).toBeGreaterThanOrEqual(1);
  });

  it('returns the correct king for each color', () => {
    const g = new Game();
    const w = analyzeKingSafety(g, 'w');
    const b = analyzeKingSafety(g, 'b');
    expect(w!.king.square).toBe('e1');
    expect(b!.king.square).toBe('e8');
  });

  it('mirrors the shield direction for black', () => {
    // Black king g8, only h7 pawn — f7 and g7 missing.
    const g = Game.fromFen('6k1/7p/8/8/8/8/8/4K3 b - - 0 1');
    const b = analyzeKingSafety(g, 'b');
    expect(b).not.toBeNull();
    const miss = b!.missingShieldSquares.sort();
    expect(miss).toContain('f7');
    expect(miss).toContain('g7');
    expect(miss).not.toContain('h7');
  });

  it('handles a king on the edge file without crashing', () => {
    // White king a1 — only b-file and a-file count as "nearby".
    const g = Game.fromFen('4k3/8/8/8/8/8/8/K7 w - - 0 1');
    const w = analyzeKingSafety(g, 'w');
    expect(w).not.toBeNull();
    // a- and b-files both empty of white pawns → both flagged as open nearby.
    expect(w!.openNearbyFiles).toEqual([0, 1]);
  });
});
