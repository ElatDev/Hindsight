import { describe, expect, it } from 'vitest';
import {
  analyzePieceActivity,
  analyzePieceActivityFor,
} from '../pieceActivity';
import { Game } from '../../game';

describe('analyzePieceActivity', () => {
  it('returns nothing notable in the starting position', () => {
    const out = analyzePieceActivity(new Game());
    expect(out.knightOutposts).toEqual([]);
    expect(out.rooksOnOpenFiles).toEqual([]);
    expect(out.rooksOnSemiOpenFiles).toEqual([]);
    // Bishops are blocked in by pawns at the start — no long diagonals.
    expect(out.activeBishops).toEqual([]);
  });

  it('flags a knight on an outpost', () => {
    // White knight d5; black pawns only on a7/h7 — c-file and e-file are
    // entirely free of black pawns ahead of d5, so d5 is a permanent outpost.
    const g = Game.fromFen('4k3/p6p/8/3N4/8/8/8/4K3 w - - 0 1');
    const out = analyzePieceActivity(g);
    expect(out.knightOutposts.find((p) => p.square === 'd5')).toBeDefined();
  });

  it('does not flag a knight when an enemy pawn can challenge the outpost', () => {
    // White knight d5; black pawn on c7 can advance to c6 and attack d5.
    const g = Game.fromFen('4k3/2p5/8/3N4/8/8/8/4K3 w - - 0 1');
    const out = analyzePieceActivity(g);
    expect(out.knightOutposts.find((p) => p.square === 'd5')).toBeUndefined();
  });

  it('flags a rook on a fully open file', () => {
    // White rook d1, no pawns on the d-file at all.
    const g = Game.fromFen('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    const out = analyzePieceActivity(g);
    expect(out.rooksOnOpenFiles.find((p) => p.square === 'd1')).toBeDefined();
    expect(
      out.rooksOnSemiOpenFiles.find((p) => p.square === 'd1'),
    ).toBeUndefined();
  });

  it('flags a rook on a semi-open file (only enemy pawns)', () => {
    // White rook d1, black pawn d7, no white pawn on d.
    const g = Game.fromFen('4k3/3p4/8/8/8/8/8/3RK3 w - - 0 1');
    const out = analyzePieceActivity(g);
    expect(
      out.rooksOnSemiOpenFiles.find((p) => p.square === 'd1'),
    ).toBeDefined();
    expect(out.rooksOnOpenFiles.find((p) => p.square === 'd1')).toBeUndefined();
  });

  it('does not flag a rook on a file with its own pawns', () => {
    // White rook d1, white pawn d2 → not even semi-open from white's side.
    const g = Game.fromFen('4k3/8/8/8/8/8/3P4/3RK3 w - - 0 1');
    const out = analyzePieceActivity(g);
    expect(out.rooksOnOpenFiles).toEqual([]);
    expect(out.rooksOnSemiOpenFiles).toEqual([]);
  });

  it('flags a fianchettoed bishop with a long diagonal', () => {
    // White bishop on g2 sweeping the h1-a8 diagonal with nothing in the way.
    const g = Game.fromFen('4k3/8/8/8/8/8/6B1/4K3 w - - 0 1');
    const out = analyzePieceActivity(g);
    expect(out.activeBishops.find((p) => p.square === 'g2')).toBeDefined();
  });

  it('does not flag a bishop hemmed in by friendly pieces', () => {
    // White bishop b2 with own pawns a3 and c3 blocking both diagonals.
    const g = Game.fromFen('4k3/8/8/8/8/P1P5/1B6/4K3 w - - 0 1');
    const out = analyzePieceActivity(g);
    expect(out.activeBishops.find((p) => p.square === 'b2')).toBeUndefined();
  });

  it('side-filtered helper returns only one color', () => {
    // Both sides have a fully open file rook.
    const g = Game.fromFen('3rk3/8/8/8/8/8/8/3RK3 w - - 0 1');
    const w = analyzePieceActivityFor(g, 'w');
    expect(w.rooksOnOpenFiles.every((p) => p.color === 'w')).toBe(true);
    expect(w.rooksOnOpenFiles.find((p) => p.square === 'd1')).toBeDefined();
    expect(w.rooksOnOpenFiles.find((p) => p.square === 'd8')).toBeUndefined();
  });
});
