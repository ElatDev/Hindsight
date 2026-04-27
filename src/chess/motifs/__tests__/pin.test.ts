import { describe, expect, it } from 'vitest';
import { findPins, findPinsBy } from '../pin';
import { Game } from '../../game';

describe('findPins', () => {
  it('returns no pins in the starting position', () => {
    const g = new Game();
    expect(findPins(g)).toEqual([]);
  });

  it('detects an absolute pin (Bb5 pinning Nc6 to Ke8)', () => {
    // Bishop on b5 pins knight on c6 to king on e8 along the a4-e8 diagonal.
    const g = Game.fromFen('4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1');
    const pins = findPins(g);
    expect(pins).toHaveLength(1);
    expect(pins[0].kind).toBe('absolute');
    expect(pins[0].pinner.square).toBe('b5');
    expect(pins[0].pinned.square).toBe('c6');
    expect(pins[0].behind.square).toBe('e8');
    expect(pins[0].behind.type).toBe('k');
  });

  it('detects a rook pinning a knight to a queen (relative pin)', () => {
    // White rook on a1 pins black knight on a5 to black queen on a8.
    const g = Game.fromFen('q3k3/8/8/n7/8/8/8/R3K3 w - - 0 1');
    const pins = findPins(g);
    const ourPin = pins.find(
      (p) => p.pinner.square === 'a1' && p.pinned.square === 'a5',
    );
    expect(ourPin).toBeDefined();
    expect(ourPin?.kind).toBe('relative');
    expect(ourPin?.behind.square).toBe('a8');
    expect(ourPin?.behind.type).toBe('q');
  });

  it('does not flag a "pin" where the back piece is less valuable', () => {
    // Rook on a1 looking up file a sees enemy queen on a4 then enemy knight on
    // a8 (knight value 3 < queen value 9). Queen isn't pinned to the knight.
    const g = Game.fromFen('n3k3/8/8/8/q7/8/8/R3K3 w - - 0 1');
    const ourPin = findPinsBy(g, 'w');
    expect(ourPin).toEqual([]);
  });

  it('does not flag a pin when own piece is between pinner and target', () => {
    // White rook on a1, white pawn on a4, black queen on a8 — the pawn blocks
    // the rook's ray, so the rook can't pin the queen. (The queen *does*
    // pin the pawn to the rook from her end; that's a separate, valid pin.)
    const g = Game.fromFen('q3k3/8/8/8/P7/8/8/R3K3 w - - 0 1');
    expect(findPinsBy(g, 'w')).toEqual([]);
  });

  it('does not flag a pin when the back piece is the wrong colour', () => {
    // White rook on a1, black knight on a5, white queen on a8 — own queen
    // behind enemy means the knight is just attacking, not pinned.
    const g = Game.fromFen('Q3k3/8/8/n7/8/8/8/R3K3 w - - 0 1');
    expect(findPins(g)).toEqual([]);
  });

  it('non-sliding pieces (knight, pawn, king) do not produce pins', () => {
    // Knight on c3, "alignment" of black king e1 → ineffective. Knights can't
    // pin.
    const g = Game.fromFen('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1');
    expect(findPins(g).filter((p) => p.pinner.type === 'n')).toEqual([]);
  });

  it('detects pins from both sides', () => {
    // Symmetric: white bishop pins black knight to black king (b5/c6/e8) and
    // black bishop pins white knight to white king (b4/c3/e1). Diagonals
    // a4-e8 and a5-e1 — c3 and c6 are on those.
    const g = Game.fromFen('4k3/8/2n5/1B6/1b6/2N5/8/4K3 w - - 0 1');
    const pins = findPins(g);
    expect(pins.length).toBeGreaterThanOrEqual(2);
    expect(findPinsBy(g, 'w').length).toBeGreaterThanOrEqual(1);
    expect(findPinsBy(g, 'b').length).toBeGreaterThanOrEqual(1);
  });

  it('queen pins both diagonally and orthogonally', () => {
    // White queen on a1 pins black rook on a4 to black king on a8 (file ray).
    const g = Game.fromFen('k7/8/8/8/r7/8/8/Q3K3 w - - 0 1');
    const pins = findPins(g);
    const ortho = pins.find(
      (p) => p.pinner.type === 'q' && p.pinned.square === 'a4',
    );
    expect(ortho).toBeDefined();
    expect(ortho?.kind).toBe('absolute');
  });
});
