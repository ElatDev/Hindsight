import { describe, expect, it } from 'vitest';
import {
  GamePhase,
  MAX_PHASE_SCORE,
  detectGamePhase,
  phaseScore,
} from '../gamePhase';
import { Game } from '../../game';

describe('phaseScore', () => {
  it('returns MAX_PHASE_SCORE for the starting position', () => {
    expect(phaseScore(new Game())).toBe(MAX_PHASE_SCORE);
  });

  it('returns 0 for a king-and-pawn endgame', () => {
    const g = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(phaseScore(g)).toBe(0);
  });

  it('counts a single queen as 4', () => {
    const g = Game.fromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1');
    expect(phaseScore(g)).toBe(4);
  });
});

describe('detectGamePhase', () => {
  it('classifies the starting position as opening', () => {
    expect(detectGamePhase(new Game())).toBe(GamePhase.Opening);
  });

  it('stays in opening through the first few moves', () => {
    const g = new Game();
    g.move('e4');
    g.move('e5');
    g.move('Nf3');
    g.move('Nc6');
    expect(detectGamePhase(g)).toBe(GamePhase.Opening);
  });

  it('classifies a king-and-pawn endgame as endgame', () => {
    const g = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(detectGamePhase(g)).toBe(GamePhase.Endgame);
  });

  it('classifies queens off + a few minors gone as endgame territory', () => {
    // Both queens off, both sides have R + N. Phase = (1+2)*2 = 6 → endgame
    // by the cutoff.
    const g = Game.fromFen('4k2r/4p3/4n3/8/8/4N3/4P3/4K2R w - - 0 1');
    expect(detectGamePhase(g)).toBe(GamePhase.Endgame);
  });

  it('classifies a typical middlegame position correctly', () => {
    // Lots of pieces still on the board, beyond opening ply count.
    const g = Game.fromPgn(
      '[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 *',
    );
    expect(detectGamePhase(g)).toBe(GamePhase.Middlegame);
  });

  it('flips to endgame after queens trade and pieces simplify', () => {
    // Construct a clearly simplified position: K + R + 4P each side.
    const g = Game.fromFen('4k3/p2r1ppp/8/8/8/8/PPP1R2P/4K3 w - - 0 1');
    expect(detectGamePhase(g)).toBe(GamePhase.Endgame);
  });
});
