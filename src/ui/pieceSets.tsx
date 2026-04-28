/* eslint-disable react-refresh/only-export-components -- this module is a
 * pure helper (no top-level component export); the lint rule misreads
 * `customPiecesFor` because it builds JSX-returning closures, but those
 * are passed by value into react-chessboard, not consumed as components by
 * any HMR boundary in this app.
 */
/**
 * Piece-set bundling. Glob-imports every SVG under `src/data/pieces/<set>/`
 * as a raw string at build time, then exposes a `customPiecesFor(theme)`
 * builder that hands react-chessboard a render-function map keyed by the
 * library's piece codes (`wK`, `bP`, …). Each function paints the SVG
 * scaled to the current square width.
 *
 * The artwork itself is fetched via `scripts/fetch-pieces.mjs` and committed
 * under `src/data/pieces/`. Refer to `src/data/pieces/LICENSE` for the
 * upstream attribution.
 */

import type { CSSProperties } from 'react';
import type { PieceTheme } from './useSettings';

/** react-chessboard's piece codes — uppercase color letter + uppercase
 *  piece type. The library renders one SVG per code. */
export type PieceCode =
  | 'wK'
  | 'wQ'
  | 'wR'
  | 'wB'
  | 'wN'
  | 'wP'
  | 'bK'
  | 'bQ'
  | 'bR'
  | 'bB'
  | 'bN'
  | 'bP';

const PIECE_CODES: ReadonlyArray<PieceCode> = [
  'wK',
  'wQ',
  'wR',
  'wB',
  'wN',
  'wP',
  'bK',
  'bQ',
  'bR',
  'bB',
  'bN',
  'bP',
];

// Eager-import every SVG under src/data/pieces/<set>/<piece>.svg as a raw
// string. The path keys come back like '../data/pieces/cburnett/wK.svg' —
// we walk them once at module-load and bucket the strings by set + code.
const RAW_FILES = import.meta.glob<string>('../data/pieces/*/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type PieceSetMap = Record<PieceTheme, Record<PieceCode, string>>;

const EMPTY_SET = (): Record<PieceCode, string> =>
  ({
    wK: '',
    wQ: '',
    wR: '',
    wB: '',
    wN: '',
    wP: '',
    bK: '',
    bQ: '',
    bR: '',
    bB: '',
    bN: '',
    bP: '',
  }) as Record<PieceCode, string>;

const PIECE_SETS: PieceSetMap = {
  cburnett: EMPTY_SET(),
  merida: EMPTY_SET(),
  alpha: EMPTY_SET(),
};

/** Strip absolute width / height attributes from the root `<svg>` element
 *  so the artwork scales to its container. The Merida set ships with
 *  `width="50mm" height="50mm"` baked in, which renders the pieces at
 *  ~189px regardless of the wrapping div — bigger than a standard square.
 *  Removing the attributes means the SVG falls back to its `viewBox` and
 *  fills the parent like Cburnett and Alpha already do. */
function normalizeSvg(raw: string): string {
  // Only touch attributes on the opening `<svg ...>` tag, not on any nested
  // element (gradients, groups, etc., shouldn't be reshaped).
  return raw.replace(/<svg\b[^>]*>/, (tag) =>
    tag.replace(/\s(width|height)\s*=\s*"[^"]*"/g, ''),
  );
}

for (const [path, raw] of Object.entries(RAW_FILES)) {
  // path looks like '../data/pieces/<set>/<piece>.svg'
  const m = /\/pieces\/([^/]+)\/([wb][KQRBNP])\.svg$/.exec(path);
  if (!m) continue;
  const [, set, code] = m;
  if (!(set in PIECE_SETS)) continue;
  PIECE_SETS[set as PieceTheme][code as PieceCode] = normalizeSvg(raw);
}

/** Tagged props the library passes when calling each piece renderer. */
type PieceRenderProps = {
  squareWidth: number;
  isDragging?: boolean;
};

const wrapperStyle = (squareWidth: number): CSSProperties => ({
  width: squareWidth,
  height: squareWidth,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
});

const innerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
};

/** Build the `customPieces` map react-chessboard expects. Pieces with a
 *  missing SVG (e.g. a partial fetch) fall back to the library's default
 *  rendering so the board never goes blank. */
export function customPiecesFor(
  theme: PieceTheme,
): Record<PieceCode, (props: PieceRenderProps) => JSX.Element> | undefined {
  const set = PIECE_SETS[theme];
  if (!set) return undefined;
  const out: Partial<
    Record<PieceCode, (props: PieceRenderProps) => JSX.Element>
  > = {};
  for (const code of PIECE_CODES) {
    const svg = set[code];
    if (!svg) continue;
    out[code] = ({ squareWidth }: PieceRenderProps): JSX.Element => (
      <div style={wrapperStyle(squareWidth)}>
        <div
          style={innerStyle}
          // The bundled SVGs come from a vetted upstream (Lichess assets);
          // they don't take user input and are tree-shaken into the build,
          // so no script-injection surface here.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    );
  }
  return out as Record<PieceCode, (props: PieceRenderProps) => JSX.Element>;
}
