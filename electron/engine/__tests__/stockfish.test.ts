import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  defaultStockfishPath,
  StockfishEngine,
  StockfishNotFoundError,
} from '../stockfish';
import { existsSync } from 'node:fs';

const binaryPath = defaultStockfishPath(process.cwd());

if (!existsSync(binaryPath)) {
  throw new Error(
    `Stockfish binary not found at ${binaryPath}. Run \`npm run fetch-stockfish\` before running tests.`,
  );
}

describe('StockfishEngine', () => {
  let engine: StockfishEngine;

  beforeAll(async () => {
    engine = new StockfishEngine({ binaryPath });
    await engine.start();
  });

  afterAll(async () => {
    await engine.quit();
  });

  it('completes the UCI handshake and reports running', () => {
    expect(engine.isRunning()).toBe(true);
  });

  it('responds to isready after handshake', async () => {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error('timed out waiting for readyok')),
        5000,
      );
      const onLine = (line: string): void => {
        if (line.trim() === 'readyok') {
          clearTimeout(t);
          engine.off('line', onLine);
          resolve();
        }
      };
      engine.on('line', onLine);
      engine.send('isready');
    });
  });

  it('rejects double-start', async () => {
    await expect(engine.start()).rejects.toThrow(/already running/i);
  });

  it('throws when constructed without a binary path or app root', () => {
    expect(() => new StockfishEngine({})).toThrow(/binaryPath.*appRoot/);
  });

  it('throws StockfishNotFoundError when start() runs against a missing binary', async () => {
    const e = new StockfishEngine({ binaryPath: '/nonexistent/stockfish-x' });
    await expect(e.start()).rejects.toBeInstanceOf(StockfishNotFoundError);
    await expect(e.start()).rejects.toMatchObject({
      message: expect.stringContaining(StockfishNotFoundError.MARKER),
      binaryPath: '/nonexistent/stockfish-x',
    });
  });
});

describe('StockfishEngine quit lifecycle', () => {
  it('isRunning() flips to false after quit', async () => {
    const e = new StockfishEngine({ binaryPath });
    await e.start();
    expect(e.isRunning()).toBe(true);
    await e.quit();
    expect(e.isRunning()).toBe(false);
  });
});
