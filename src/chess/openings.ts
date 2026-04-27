import ecoData from '../data/eco.json';
import type { SanMove } from './game';

export type EcoEntry = {
  /** ECO code, e.g. `"B90"`. */
  eco: string;
  /** Human-readable name with variation, e.g.
   *  `"Sicilian Defense: Najdorf Variation"`. */
  name: string;
  /** Original PGN string from the source dataset. */
  pgn: string;
  /** Move list as flat SAN tokens, no move numbers, no result. */
  san: SanMove[];
};

const ENTRIES = ecoData as readonly EcoEntry[];

/**
 * Index every ECO entry by the SAN of its first move so the matcher only
 * needs to scan a small candidate set per position. Built once at module
 * load — the dataset is ~3.7k entries, so the overhead is negligible.
 */
const BY_FIRST_MOVE: ReadonlyMap<SanMove, readonly EcoEntry[]> = (() => {
  const map = new Map<SanMove, EcoEntry[]>();
  for (const entry of ENTRIES) {
    const first = entry.san[0];
    if (!first) continue;
    const list = map.get(first) ?? [];
    list.push(entry);
    map.set(first, list);
  }
  return map;
})();

/**
 * Identify the opening of a game from its SAN move list.
 *
 * Returns the longest ECO entry whose move list is a prefix of the given
 * `moves`. That's the standard "deepest match wins" rule: a Najdorf line
 * should resolve to the Najdorf entry rather than the parent "Sicilian"
 * entry, even though both technically match.
 *
 * Returns `null` when no entry matches the opening — most realistically when
 * the very first move isn't in the database (rare for legal play).
 *
 * Performance: O(K) per call where K = number of entries starting with the
 * same first move (typically a few hundred for popular first moves like
 * 1. e4). The data is sorted longest-first at build time, so the matcher can
 * return on first hit.
 */
export function identifyOpening(moves: readonly SanMove[]): EcoEntry | null {
  if (moves.length === 0) return null;
  const candidates = BY_FIRST_MOVE.get(moves[0]);
  if (!candidates) return null;

  for (const entry of candidates) {
    if (entry.san.length > moves.length) continue;
    if (isPrefix(entry.san, moves)) return entry;
  }
  return null;
}

function isPrefix(
  needle: readonly SanMove[],
  haystack: readonly SanMove[],
): boolean {
  for (let i = 0; i < needle.length; i++) {
    if (needle[i] !== haystack[i]) return false;
  }
  return true;
}

/** Number of entries currently bundled (for diagnostics / tests). */
export const ECO_ENTRY_COUNT = ENTRIES.length;
