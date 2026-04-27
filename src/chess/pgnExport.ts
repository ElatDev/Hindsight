/**
 * Phase 12 / Task 3 — annotated PGN exporter. Takes the raw `Game` and the
 * `GameReview` produced by `runGameReview` and emits a single PGN string with
 * per-move NAG glyphs (classification → standard NAG number), `[%eval ...]`
 * comments (Lichess-compatible), and the rendered explanation as a free-text
 * comment. Pure string assembly — no chess.js PGN regen, since chess.js
 * doesn't expose a NAG setter and round-tripping through `pgn()` would force
 * us to do brittle post-hoc string surgery anyway.
 *
 * Edge cases:
 *   - Game starts from a non-standard position with black to move: we read
 *     the side-to-move + fullmove number from `perMove[0].evalBefore`-time
 *     FEN where available, but fall back to assuming white-first if the
 *     review is empty. Output is always parseable PGN.
 *   - Headers from the source game are preserved; we layer Hindsight-supplied
 *     tags (`Annotator`) on top, and emit a `[Result "..."]` row matching the
 *     game's terminal state when the source PGN lacks one.
 */

import type { Classification } from './classify';
import type { Game } from './game';
import type { EvalSnapshot, GameReview, ReviewedMove } from './review';

/** NAG glyphs we attach to each classification. Best/excellent/good/book
 *  emit nothing — bare SAN is correct PGN and avoids visual noise. */
const NAG_FOR: Partial<Record<Classification, string>> = {
  sharp: '$3', // !!
  inaccuracy: '$6', // ?!
  mistake: '$2', // ?
  blunder: '$4', // ??
  miss: '$2', // ?
};

const APP_TAG_VALUE = 'Hindsight';

export type ExportPgnOptions = {
  /** Override or add headers. Merged on top of the source PGN's headers. */
  readonly extraHeaders?: Record<string, string>;
  /** Include the rendered explanation in the per-move comment. Default true. */
  readonly includeExplanations?: boolean;
  /** Soft-wrap movetext at this column. Default 80. Pass 0 to disable. */
  readonly maxWidth?: number;
};

/** Build the annotated PGN. The function is pure — same inputs always yield
 *  the same output, suitable for testing without a Stockfish dependency. */
export function exportAnnotatedPgn(
  game: Game,
  review: GameReview,
  opts: ExportPgnOptions = {},
): string {
  const includeExplanations = opts.includeExplanations !== false;
  const maxWidth = opts.maxWidth ?? 80;

  const sourceHeaders = game.headers();
  const headers: Record<string, string> = {
    ...sourceHeaders,
    Annotator: APP_TAG_VALUE,
    ...(opts.extraHeaders ?? {}),
  };
  if (review.opening && !headers.Opening) headers.Opening = review.opening.name;
  if (review.opening && !headers.ECO) headers.ECO = review.opening.eco;
  // chess.js seeds new games with Result="*" — override when the game has
  // actually finished so the Result header reflects reality.
  if (!headers.Result || headers.Result === '*') {
    headers.Result = inferResult(game);
  }

  const headerBlock = SEVEN_TAG_ROSTER.map((tag) =>
    formatHeader(tag, headers[tag] ?? '?'),
  )
    .concat(
      Object.entries(headers)
        .filter(([k]) => !SEVEN_TAG_ROSTER.includes(k))
        .map(([k, v]) => formatHeader(k, v)),
    )
    .join('\n');

  const movetext = formatMovetext(
    review.perMove,
    includeExplanations,
    headers.Result,
  );
  const wrapped = maxWidth > 0 ? wrapMovetext(movetext, maxWidth) : movetext;

  return `${headerBlock}\n\n${wrapped}\n`;
}

/** PGN's mandatory tags, emitted in order at the top of the header block. */
const SEVEN_TAG_ROSTER = [
  'Event',
  'Site',
  'Date',
  'Round',
  'White',
  'Black',
  'Result',
];

function formatHeader(key: string, value: string): string {
  return `[${key} "${escapePgnString(value)}"]`;
}

function escapePgnString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function inferResult(game: Game): string {
  const end = game.gameEnd();
  if (end === 'checkmate') {
    // The side to move is the one who just got mated.
    return game.turn() === 'w' ? '0-1' : '1-0';
  }
  if (
    end === 'stalemate' ||
    end === 'threefold-repetition' ||
    end === 'fifty-move' ||
    end === 'insufficient-material' ||
    end === 'draw'
  ) {
    return '1/2-1/2';
  }
  return '*';
}

function formatMovetext(
  moves: readonly ReviewedMove[],
  includeExplanations: boolean,
  result: string,
): string {
  if (moves.length === 0) return result;
  const tokens: string[] = [];
  for (let i = 0; i < moves.length; i += 1) {
    const m = moves[i];
    const isWhiteMove = m.ply % 2 === 1;
    const moveNumber = Math.floor((m.ply + 1) / 2);
    if (isWhiteMove) tokens.push(`${moveNumber}.`);
    else if (i === 0) tokens.push(`${moveNumber}...`);
    tokens.push(m.san);
    const nag = NAG_FOR[m.classification];
    if (nag) tokens.push(nag);
    const comment = buildComment(m, includeExplanations);
    if (comment) tokens.push(`{${comment}}`);
  }
  tokens.push(result);
  return tokens.join(' ');
}

function buildComment(
  move: ReviewedMove,
  includeExplanations: boolean,
): string {
  const parts: string[] = [];
  const evalToken = formatEvalForPgn(move.evalAfter);
  if (evalToken) parts.push(`[%eval ${evalToken}]`);
  if (includeExplanations && move.explanation) {
    parts.push(sanitizeComment(move.explanation));
  }
  return parts.join(' ').trim();
}

/** Lichess `[%eval ...]` payload: a signed pawn fraction (`0.42`, `-1.20`)
 *  for cp scores, `#N` / `#-N` for mate. Returns the empty string when the
 *  snapshot has neither (so the caller can suppress the `[%eval ...]` block
 *  entirely instead of emitting one with no value). */
function formatEvalForPgn(snap: EvalSnapshot): string {
  if (snap.mate != null) {
    return snap.mate >= 0 ? `#${snap.mate}` : `#-${Math.abs(snap.mate)}`;
  }
  if (snap.cp != null) {
    const pawns = snap.cp / 100;
    return pawns.toFixed(2);
  }
  return '';
}

/** Strip characters that would break PGN comment framing. PGN comments are
 *  delimited by `{` and `}`; nested braces aren't allowed. We replace the
 *  closing brace and collapse internal newlines so a templated explanation
 *  with line breaks doesn't fragment the movetext. */
function sanitizeComment(text: string): string {
  return text.replace(/\}/g, ')').replace(/\s+/g, ' ').trim();
}

/** Soft-wrap movetext at `maxWidth`, breaking only at whitespace and never
 *  inside a `{...}` comment. PGN tools tolerate long lines, but most pretty-
 *  printers stay under 80; we mirror that. */
function wrapMovetext(text: string, maxWidth: number): string {
  const lines: string[] = [];
  let line = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      const end = text.indexOf('}', i);
      const chunk = end === -1 ? text.slice(i) : text.slice(i, end + 1);
      if (line.length + chunk.length + 1 > maxWidth && line.length > 0) {
        lines.push(line);
        line = '';
      }
      line = line.length === 0 ? chunk : `${line} ${chunk}`;
      i = end === -1 ? text.length : end + 1;
      // Skip a single separator space so the next token starts cleanly.
      if (text[i] === ' ') i += 1;
      continue;
    }
    const nextBrace = text.indexOf('{', i);
    const segmentEnd = nextBrace === -1 ? text.length : nextBrace;
    const tokens = text.slice(i, segmentEnd).split(' ').filter(Boolean);
    for (const token of tokens) {
      if (line.length + token.length + 1 > maxWidth && line.length > 0) {
        lines.push(line);
        line = token;
      } else {
        line = line.length === 0 ? token : `${line} ${token}`;
      }
    }
    i = segmentEnd;
  }
  if (line.length > 0) lines.push(line);
  return lines.join('\n');
}
