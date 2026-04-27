import { describe, expect, it } from 'vitest';
import { findDiscoveredAttacks, isDiscoveredCheck } from '../discovered';
import { Game } from '../../game';

describe('findDiscoveredAttacks', () => {
  it('detects a classic discovered check (rook on e-file, knight steps off)', () => {
    // White rook e1, white knight e5, black king e8. Knight moves to f3
    // unblocking the rook → discovered check.
    const g = Game.fromFen('4k3/8/8/4N3/8/8/8/4R2K w - - 0 1');
    const out = findDiscoveredAttacks(g, 'Nf3');
    const checks = out.filter((d) => d.isCheck);
    expect(checks).toHaveLength(1);
    expect(checks[0].attacker.square).toBe('e1');
    expect(checks[0].attacker.type).toBe('r');
    expect(checks[0].target.type).toBe('k');
  });

  it('flags discovered attack on a non-king target', () => {
    // White bishop a1, white knight d4, black queen h8. Knight moves off
    // the diagonal → bishop now attacks queen.
    const g = Game.fromFen('7q/7k/8/8/3N4/8/8/B3K3 w - - 0 1');
    const out = findDiscoveredAttacks(g, 'Nf5');
    const onQueen = out.find(
      (d) => d.target.type === 'q' && d.attacker.type === 'b',
    );
    expect(onQueen).toBeDefined();
    expect(onQueen?.isCheck).toBe(false);
  });

  it('does not flag a direct attack from the moved piece itself', () => {
    // No teammates revealing anything; the knight just attacks something new.
    const g = Game.fromFen('4k3/8/8/8/8/8/4N3/4K3 w - - 0 1');
    const out = findDiscoveredAttacks(g, 'Nf4');
    expect(out).toEqual([]);
  });

  it('does not flag attacks that already existed before the move', () => {
    // Rook on a1 attacks knight on a4 already. White king moves to e2.
    // The rook's attack on a4 is unchanged → not "discovered" (pre-existing).
    const g = Game.fromFen('4k3/8/8/8/n7/8/8/R3K3 w - - 0 1');
    const out = findDiscoveredAttacks(g, 'Ke2');
    expect(out.find((d) => d.target.square === 'a4')).toBeUndefined();
  });

  it('returns empty for an illegal move', () => {
    const g = new Game();
    expect(findDiscoveredAttacks(g, 'Qxh8')).toEqual([]);
  });

  it('does not mutate the input Game', () => {
    const g = Game.fromFen('4k3/8/8/4N3/8/8/8/4R2K w - - 0 1');
    const before = g.fen();
    findDiscoveredAttacks(g, 'Nf3');
    expect(g.fen()).toBe(before);
  });
});

describe('isDiscoveredCheck', () => {
  it('returns true for the canonical rook+knight discovered check', () => {
    const g = Game.fromFen('4k3/8/8/4N3/8/8/8/4R2K w - - 0 1');
    expect(isDiscoveredCheck(g, 'Nf3')).toBe(true);
  });

  it('returns false for a direct check (queen check, no teammate revealed)', () => {
    // Queen on d1, black king on d8 — Qxd8+ would be direct check (queen
    // moves to give check), not discovered.
    const g = Game.fromFen('3k3K/8/8/8/8/8/8/3Q4 w - - 0 1');
    expect(isDiscoveredCheck(g, 'Qd5+')).toBe(false);
  });

  it('returns false for a quiet move that reveals no checks', () => {
    const g = new Game();
    expect(isDiscoveredCheck(g, 'e4')).toBe(false);
  });
});
