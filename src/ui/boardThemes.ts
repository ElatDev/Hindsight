/**
 * Board palette definitions. Each palette is a `(light, dark)` pair of CSS
 * colours wired to react-chessboard's `customLightSquareStyle` /
 * `customDarkSquareStyle`. The set spans both chess-canon (classic, blue,
 * green, gray — borrowed from Lichess / chess.com) and a few more saturated
 * picks (walnut for richer brown, rose for warmth, ocean / midnight for
 * darker contrast, mint for a cooler green than the canonical "green").
 *
 * Piece-set selection (Cburnett / Merida / Alpha) is the matching half of
 * Phase 12 / Task 8 and is carved out for a separate follow-up — the asset
 * bundles run ~100KB each and want their own dedicated landing. The radio
 * in the Settings dialog labels itself as preview-only until that ships.
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
  walnut: { light: '#E8C99B', dark: '#7C4A2D' },
  rose: { light: '#F4DDDD', dark: '#C18585' },
  ocean: { light: '#D0E2EE', dark: '#4A7CA0' },
  midnight: { light: '#A6B8CB', dark: '#2C3E50' },
  mint: { light: '#E8F4E0', dark: '#74A87E' },
};
