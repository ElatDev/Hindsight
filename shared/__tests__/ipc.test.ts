import { describe, expect, it } from 'vitest';
import { parseStockfishNotFound, STOCKFISH_NOT_FOUND_MARKER } from '../ipc';

describe('parseStockfishNotFound', () => {
  it('returns the path when the message carries the marker', () => {
    const msg = `${STOCKFISH_NOT_FOUND_MARKER} Stockfish binary not found at C:\\app\\stockfish\\bin\\win32-x64\\stockfish.exe`;
    expect(parseStockfishNotFound(msg)).toBe(
      'C:\\app\\stockfish\\bin\\win32-x64\\stockfish.exe',
    );
  });

  it('returns null when the marker is absent', () => {
    expect(parseStockfishNotFound('Some other engine error')).toBeNull();
    expect(parseStockfishNotFound('')).toBeNull();
  });

  it('tolerates the marker with surrounding noise', () => {
    const msg = `Error: ${STOCKFISH_NOT_FOUND_MARKER} Stockfish binary not found at /opt/stockfish — please install`;
    expect(parseStockfishNotFound(msg)).toBe('/opt/stockfish — please install');
  });
});
