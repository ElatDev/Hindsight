/**
 * Phase 12 / Task 8 — board palette definitions. Each palette is a
 * (light, dark) pair of CSS colours wired to react-chessboard's
 * `customLightSquareStyle` / `customDarkSquareStyle`. Picked to be visually
 * distinct without straying from chess-canon palettes (so the user can
 * carry their pattern recognition across apps).
 *
 * Piece-set selection (Cburnett / Merida / Alpha) is the matching half of
 * Task 8 and is carved out for a separate follow-up — the asset bundles run
 * ~100KB each and want their own dedicated landing.
 */

import type { BoardTheme } from './useSettings';

export type BoardPalette = {
  readonly light: string;
  readonly dark: string;
};

export const BOARD_PALETTES: Record<BoardTheme, BoardPalette> = {
  classic: { light: '#F0D9B5', dark: '#B58863' },
  blue: { light: '#DEE3E6', dark: '#8CA2AD' },
  green: { light: '#FFFFDD', dark: '#86A666' },
  gray: { light: '#DCDCDC', dark: '#7E7E7E' },
};
