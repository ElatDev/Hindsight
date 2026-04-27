import { describe, expect, it } from 'vitest';
import { ECO_ENTRY_COUNT, identifyOpening } from '../openings';

describe('identifyOpening', () => {
  it('bundles a non-trivial number of ECO entries', () => {
    expect(ECO_ENTRY_COUNT).toBeGreaterThan(3000);
  });

  it('returns null for an empty move list', () => {
    expect(identifyOpening([])).toBeNull();
  });

  it('identifies the Sicilian Defense from 1. e4 c5', () => {
    const out = identifyOpening(['e4', 'c5']);
    expect(out).not.toBeNull();
    expect(out!.name.toLowerCase()).toContain('sicilian');
  });

  it('identifies the Najdorf when the moves go that deep', () => {
    // 1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 — the Najdorf.
    const out = identifyOpening([
      'e4',
      'c5',
      'Nf3',
      'd6',
      'd4',
      'cxd4',
      'Nxd4',
      'Nf6',
      'Nc3',
      'a6',
    ]);
    expect(out).not.toBeNull();
    expect(out!.name.toLowerCase()).toContain('najdorf');
    expect(out!.eco).toMatch(/^B9/);
  });

  it('prefers the deepest match over a parent variation', () => {
    // A bare 1. e4 c5 should resolve to plain "Sicilian Defense" (B20),
    // but 1. e4 c5 2. Nf3 should reach a deeper line, not stay at B20.
    const shallow = identifyOpening(['e4', 'c5']);
    const deeper = identifyOpening(['e4', 'c5', 'Nf3', 'd6']);
    expect(shallow).not.toBeNull();
    expect(deeper).not.toBeNull();
    expect(deeper!.san.length).toBeGreaterThan(shallow!.san.length);
  });

  it('identifies the Ruy Lopez (Spanish) opening', () => {
    const out = identifyOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
    expect(out).not.toBeNull();
    const name = out!.name.toLowerCase();
    expect(name === 'ruy lopez' || name.startsWith('ruy lopez')).toBe(true);
  });

  it('identifies the Queens Gambit', () => {
    const out = identifyOpening(['d4', 'd5', 'c4']);
    expect(out).not.toBeNull();
    expect(out!.name.toLowerCase()).toContain("queen's gambit");
  });

  it('returns null for a first move not in the database', () => {
    // No legal opening starts with this nonsense SAN string, so the
    // first-move bucket is empty.
    expect(identifyOpening(['Zz9'])).toBeNull();
  });

  it('returns the longest matching entry even when extra non-book moves follow', () => {
    // Standard Italian Game opening, then a totally unbook move. The matcher
    // should still return the Italian, ignoring trailing moves it can't
    // recognise.
    const out = identifyOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'h6']);
    expect(out).not.toBeNull();
    expect(out!.name.toLowerCase()).toContain('italian');
  });
});
