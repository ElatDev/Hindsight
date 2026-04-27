import { useMemo } from 'react';
import type { Game } from '../chess/game';
import { analyzeKingSafety } from '../chess/positional/kingSafety';
import { analyzeMaterial } from '../chess/positional/material';
import { analyzePawnStructure } from '../chess/positional/pawnStructure';
import { analyzePieceActivity } from '../chess/positional/pieceActivity';
import type { PieceLocation } from '../chess/motifs/util';

export type PositionalPanelProps = {
  /** The position to analyse — typically the renderer's `displayed` game,
   *  i.e. the position at the current review ply. */
  game: Game;
};

const PIECE_NAME = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
} as const;

/**
 * Static positional summary of the current position. Wires the four Phase 8
 * analyzers (`pawnStructure`, `kingSafety`, `pieceActivity`, `material`) into
 * a single side-panel surface so the review actually exposes them. Each
 * sub-section degrades gracefully when there's nothing structural to call out
 * (omits the row entirely rather than rendering "0 isolated, 0 doubled, …").
 *
 * The panel is intentionally compact and read-only — a "what does the board
 * look like right now" snapshot, not a coaching narrative. The narrative
 * lives in the per-move explanation panel above it.
 */
export function PositionalPanel({ game }: PositionalPanelProps): JSX.Element {
  const fen = game.fen();

  const summary = useMemo(() => {
    const whitePawns = analyzePawnStructure(game, 'w');
    const blackPawns = analyzePawnStructure(game, 'b');
    const whiteKing = analyzeKingSafety(game, 'w');
    const blackKing = analyzeKingSafety(game, 'b');
    const activity = analyzePieceActivity(game);
    const material = analyzeMaterial(game);

    return {
      pawns: { w: whitePawns, b: blackPawns },
      king: { w: whiteKing, b: blackKing },
      activity,
      material,
    };
    // The dependency is the FEN string — same FEN, identical analysis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  const hasPawnStructure = (() => {
    const { w, b } = summary.pawns;
    return (
      w.doubled.length +
        w.isolated.length +
        w.backward.length +
        w.passed.length +
        b.doubled.length +
        b.isolated.length +
        b.backward.length +
        b.passed.length >
      0
    );
  })();

  const hasActivity =
    summary.activity.knightOutposts.length +
      summary.activity.rooksOnOpenFiles.length +
      summary.activity.rooksOnSemiOpenFiles.length +
      summary.activity.activeBishops.length >
    0;

  const hasKingDanger =
    (summary.king.w?.exposure ?? 0) + (summary.king.b?.exposure ?? 0) > 0;

  return (
    <section className="positional-panel" aria-label="Positional snapshot">
      <h3 className="positional-panel__title">Position notes</h3>

      <p className="positional-panel__row">
        <strong>Material:</strong> {formatMaterial(summary.material)}
      </p>

      {hasPawnStructure ? (
        <p className="positional-panel__row">
          <strong>Pawns:</strong> {formatPawnStructure(summary.pawns)}
        </p>
      ) : null}

      {hasKingDanger ? (
        <p className="positional-panel__row">
          <strong>King safety:</strong> {formatKingSafety(summary.king)}
        </p>
      ) : null}

      {hasActivity ? (
        <p className="positional-panel__row">
          <strong>Activity:</strong> {formatActivity(summary.activity)}
        </p>
      ) : null}
    </section>
  );
}

function formatMaterial(m: ReturnType<typeof analyzeMaterial>): string {
  const parts: string[] = [];
  if (m.diff === 0) {
    parts.push('Even');
  } else {
    const leader = m.diff > 0 ? 'White' : 'Black';
    parts.push(`${leader} +${Math.abs(m.diff)}`);
  }
  const surplus: string[] = [];
  for (const t of ['q', 'r', 'b', 'n', 'p'] as const) {
    const d = m.countDelta[t];
    if (d === 0) continue;
    const side = d > 0 ? 'W' : 'B';
    const count = Math.abs(d);
    surplus.push(
      count === 1
        ? `${side} +1 ${PIECE_NAME[t]}`
        : `${side} +${count} ${PIECE_NAME[t]}s`,
    );
  }
  if (surplus.length > 0) parts.push(`(${surplus.join(', ')})`);
  if (m.bishopPair) {
    parts.push(`— ${m.bishopPair === 'w' ? 'White' : 'Black'} has bishop pair`);
  }
  return parts.join(' ');
}

function formatPawnStructure(pawns: {
  w: ReturnType<typeof analyzePawnStructure>;
  b: ReturnType<typeof analyzePawnStructure>;
}): string {
  const lines: string[] = [];
  for (const [color, label] of [
    ['w', 'White'],
    ['b', 'Black'],
  ] as const) {
    const p = pawns[color];
    const segs: string[] = [];
    if (p.passed.length > 0) {
      segs.push(`passed ${formatSquares(p.passed)}`);
    }
    if (p.isolated.length > 0) {
      segs.push(`isolated ${formatSquares(p.isolated)}`);
    }
    if (p.doubled.length > 0) {
      segs.push(`doubled ${formatSquares(p.doubled)}`);
    }
    if (p.backward.length > 0) {
      segs.push(`backward ${formatSquares(p.backward)}`);
    }
    if (segs.length > 0) lines.push(`${label}: ${segs.join(', ')}`);
  }
  return lines.join(' · ');
}

function formatKingSafety(king: {
  w: ReturnType<typeof analyzeKingSafety>;
  b: ReturnType<typeof analyzeKingSafety>;
}): string {
  const lines: string[] = [];
  for (const [color, label] of [
    ['w', 'White'],
    ['b', 'Black'],
  ] as const) {
    const k = king[color];
    if (!k || k.exposure === 0) continue;
    const tags: string[] = [];
    if (k.openNearbyFiles.length > 0) {
      const files = k.openNearbyFiles
        .map((f) => String.fromCharCode(97 + f))
        .join('/');
      tags.push(`${files}-file open`);
    }
    if (k.missingShieldSquares.length > 0) {
      tags.push(`shield gaps ${k.missingShieldSquares.join(',')}`);
    }
    if (k.attackerCount > 0) {
      tags.push(`${k.attackerCount} on king ring`);
    }
    lines.push(`${label} (${k.exposure}): ${tags.join('; ') || 'exposed'}`);
  }
  return lines.join(' · ');
}

function formatActivity(
  activity: ReturnType<typeof analyzePieceActivity>,
): string {
  const segs: string[] = [];
  if (activity.knightOutposts.length > 0) {
    segs.push(`outposts ${formatSquares(activity.knightOutposts)}`);
  }
  if (activity.rooksOnOpenFiles.length > 0) {
    segs.push(`rooks (open) ${formatSquares(activity.rooksOnOpenFiles)}`);
  }
  if (activity.rooksOnSemiOpenFiles.length > 0) {
    segs.push(
      `rooks (semi-open) ${formatSquares(activity.rooksOnSemiOpenFiles)}`,
    );
  }
  if (activity.activeBishops.length > 0) {
    segs.push(`active bishops ${formatSquares(activity.activeBishops)}`);
  }
  return segs.join(' · ');
}

function formatSquares(pieces: PieceLocation[]): string {
  return pieces.map((p) => p.square).join(',');
}
