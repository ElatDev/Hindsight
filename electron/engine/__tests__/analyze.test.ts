import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { defaultStockfishPath, StockfishEngine } from '../stockfish';
import { analyzePosition } from '../analyze';

const binaryPath = defaultStockfishPath(process.cwd());

if (!existsSync(binaryPath)) {
  throw new Error(
    `Stockfish binary not found at ${binaryPath}. Run \`npm run fetch-stockfish\` before running tests.`,
  );
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// White to play, Rd1-d8 is mate. (Black king g8, no escape.)
const MATE_IN_1_FEN = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';

describe('analyzePosition', () => {
  let engine: StockfishEngine;

  beforeAll(async () => {
    engine = new StockfishEngine({ binaryPath });
    await engine.start();
  });

  afterAll(async () => {
    await engine.quit();
  });

  it('returns a legal best move from the starting position', async () => {
    const result = await analyzePosition(engine, STARTING_FEN, { depth: 8 });
    expect(result.bestMove).toBeTruthy();
    // The first ply of any sensible engine line is one of the standard openings.
    expect(['e2e4', 'd2d4', 'g1f3', 'c2c4']).toContain(result.bestMove);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].pv.length).toBeGreaterThan(0);
    expect(result.lines[0].evalCp).not.toBeNull();
  });

  it('detects mate in 1', async () => {
    const result = await analyzePosition(engine, MATE_IN_1_FEN, { depth: 6 });
    expect(result.bestMove).toBe('d1d8');
    expect(result.lines[0].mateIn).toBe(1);
    expect(result.lines[0].evalCp).toBeNull();
  });

  it('returns multiple PV lines when multiPV > 1', async () => {
    const result = await analyzePosition(engine, STARTING_FEN, {
      depth: 6,
      multiPV: 3,
    });
    expect(result.lines).toHaveLength(3);
    // multipv indices should be 1, 2, 3 in order.
    expect(result.lines.map((l) => l.multipv)).toEqual([1, 2, 3]);
    // Each line's first PV move should be distinct.
    const firstMoves = new Set(result.lines.map((l) => l.pv[0]));
    expect(firstMoves.size).toBe(3);
  });
});
