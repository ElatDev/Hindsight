import { Chess, type Color, type Move } from 'chess.js';

export type { Color, Move };

export type Fen = string;
export type Pgn = string;
export type SanMove = string;

/** A PGN comment attached to the position with `fen`. */
export type PgnComment = { fen: string; comment: string };

/**
 * Terminal game states we surface. `null` means the game is still ongoing.
 * Exposed as both a `const` (for runtime comparisons) and a string-literal
 * union type (for exhaustive switches).
 */
export const GameEnd = {
  Checkmate: 'checkmate',
  Stalemate: 'stalemate',
  ThreefoldRepetition: 'threefold-repetition',
  FiftyMove: 'fifty-move',
  InsufficientMaterial: 'insufficient-material',
  Draw: 'draw',
} as const;
export type GameEnd = (typeof GameEnd)[keyof typeof GameEnd] | null;

/**
 * Thin wrapper around `chess.js` that pins down the API surface our app uses
 * (load PGN/FEN, make moves, query state, walk history, detect game end).
 * Keeps the rest of the code free of direct `chess.js` imports so we can swap
 * or extend the chess engine without rippling changes.
 */
export class Game {
  private readonly chess: Chess;

  constructor() {
    this.chess = new Chess();
  }

  /** Build a `Game` from a FEN string. Throws on invalid FEN. */
  static fromFen(fen: Fen): Game {
    const g = new Game();
    g.chess.load(fen);
    return g;
  }

  /** Build a `Game` from a PGN string. Throws on invalid PGN. */
  static fromPgn(pgn: Pgn): Game {
    const g = new Game();
    g.chess.loadPgn(pgn);
    return g;
  }

  /** Reset to the initial position. */
  reset(): void {
    this.chess.reset();
  }

  /**
   * Load a PGN string into this game, replacing any existing state. Accepts
   * the full PGN feature set chess.js supports: headers, brace comments,
   * NAGs (`$N` glyphs and shorthand like `!`/`?`), and parenthesised
   * variations. Variations are parsed but not retained — only the main line
   * survives in `history()` (this is the v1 behaviour documented in
   * PROGRESS.md / Phase 2 Task 2).
   */
  load(pgn: Pgn): void {
    this.chess.loadPgn(pgn);
  }

  /** Load a FEN string into this game, replacing any existing state. */
  loadFen(fen: Fen): void {
    this.chess.load(fen);
  }

  /** PGN headers (Seven Tag Roster + any custom tags) from the most recent
   *  `load(pgn)` / `Game.fromPgn(pgn)` call. Empty when the game wasn't
   *  loaded from a PGN. */
  headers(): Record<string, string> {
    return this.chess.getHeaders();
  }

  /** PGN comments tied to the FEN of the position they annotate. */
  comments(): PgnComment[] {
    return this.chess.getComments();
  }

  /**
   * Apply a move (SAN like "Nf3" or "exd5", or UCI-style "e2e4"/"e7e8q").
   * Returns the resulting `Move` on success, `null` if the move is illegal.
   */
  move(move: SanMove): Move | null {
    try {
      return this.chess.move(move);
    } catch {
      return null;
    }
  }

  /** Undo the last applied move, or null if there's nothing to undo. */
  undo(): Move | null {
    return this.chess.undo();
  }

  /** Current FEN string. */
  fen(): Fen {
    return this.chess.fen();
  }

  /** Side to move. */
  turn(): Color {
    return this.chess.turn();
  }

  /** All legal moves in SAN. */
  legalMoves(): SanMove[] {
    return this.chess.moves();
  }

  /** All legal moves with full `Move` objects (from/to squares, captured piece, flags). */
  legalMovesVerbose(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  /** Move history in SAN. */
  history(): SanMove[] {
    return this.chess.history();
  }

  /** Move history with full `Move` objects. */
  historyVerbose(): Move[] {
    return this.chess.history({ verbose: true });
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  /**
   * Classify the terminal state of the game. Returns `null` if the game is
   * still ongoing. Order matters: more specific checks come first so a
   * checkmate is never reported as "draw".
   */
  gameEnd(): GameEnd {
    if (this.chess.isCheckmate()) return GameEnd.Checkmate;
    if (this.chess.isStalemate()) return GameEnd.Stalemate;
    if (this.chess.isThreefoldRepetition()) return GameEnd.ThreefoldRepetition;
    if (this.chess.isDrawByFiftyMoves()) return GameEnd.FiftyMove;
    if (this.chess.isInsufficientMaterial())
      return GameEnd.InsufficientMaterial;
    if (this.chess.isDraw()) return GameEnd.Draw;
    return null;
  }

  /** Direct access to the underlying chess.js instance for advanced use cases
   *  (e.g., square-attacker queries the wrapper hasn't surfaced yet). Prefer
   *  the wrapper methods; this is an escape hatch. */
  raw(): Chess {
    return this.chess;
  }
}
