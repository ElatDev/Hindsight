import { Chess, type Color, type Move } from 'chess.js';

export type { Color, Move };

export type Fen = string;
export type Pgn = string;
export type SanMove = string;

/** All terminal game states we surface. `null` means the game is still ongoing. */
export type GameEnd =
  | 'checkmate'
  | 'stalemate'
  | 'threefold-repetition'
  | 'fifty-move'
  | 'insufficient-material'
  | 'draw'
  | null;

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

  /** Load a PGN string into this game, replacing any existing state. */
  load(pgn: Pgn): void {
    this.chess.loadPgn(pgn);
  }

  /** Load a FEN string into this game, replacing any existing state. */
  loadFen(fen: Fen): void {
    this.chess.load(fen);
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
    if (this.chess.isCheckmate()) return 'checkmate';
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isThreefoldRepetition()) return 'threefold-repetition';
    if (this.chess.isDrawByFiftyMoves()) return 'fifty-move';
    if (this.chess.isInsufficientMaterial()) return 'insufficient-material';
    if (this.chess.isDraw()) return 'draw';
    return null;
  }

  /** Direct access to the underlying chess.js instance for advanced use cases
   *  (e.g., square-attacker queries the wrapper hasn't surfaced yet). Prefer
   *  the wrapper methods; this is an escape hatch. */
  raw(): Chess {
    return this.chess;
  }
}
