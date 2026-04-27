/**
 * The Hindsight explanation library: 100+ short, hand-written snippets that
 * the review UI surfaces beneath each move. Each entry pairs a template
 * source (DSL syntax — see `dsl.ts`) with the criteria that decide *when*
 * the selector may pick it.
 *
 * # Render context
 *
 * Every template assumes a stable set of context variables, supplied by the
 * orchestration layer at render time. Listing them here so the schema can be
 * grokked at a glance:
 *
 *  - identity      `mover`, `opponent`, `san`, `piece`, `from`, `to`,
 *                  `captured`
 *  - flags         `isCapture`, `isCheck`
 *  - eval          `cpLoss`, `evalBefore`, `evalAfter`, `bestSan`,
 *                  `bestPiece`, `bestTo`
 *  - phase         `phase`
 *  - mate          `wasMating`, `nowBeingMated`, `mateIn`, `mateInAfter`
 *  - motif data    `forkTargets`, `pinnedPiece`, `pinTo`, `skeweredPiece`,
 *                  `skeweredBy`, `hangingPiece`, `hangingSquare`,
 *                  `attackerPiece`, `defendedPiece`, `defendedSquare`,
 *                  `backRankPiece`, `threatSan`, `attackedSquare`
 *  - opening       `opening`, `ecoCode`
 *
 * Templates with motif-specific criteria may freely reference the matching
 * motif data vars — by construction the selector won't pick them otherwise.
 *
 * # Specificity
 *
 * Templates with tighter criteria (motif + classification, motif + phase,
 * etc.) outrank classification-only ones, which outrank wildcards. The
 * selector handles the ranking; we just have to make sure each bucket has
 * enough variety that the UI doesn't read like a stuck record.
 */

import { Classification } from '../classify';
import { GamePhase } from '../positional/gamePhase';
import type { TemplateRegistry } from './registry';
import type { TemplateCriteria, TemplateSelector } from './selector';

const Best = Classification.Best;
const Sharp = Classification.Sharp;
const Excellent = Classification.Excellent;
const Good = Classification.Good;
const Inaccuracy = Classification.Inaccuracy;
const Mistake = Classification.Mistake;
const Blunder = Classification.Blunder;
const Miss = Classification.Miss;
const Book = Classification.Book;

const Opening = GamePhase.Opening;
const Middlegame = GamePhase.Middlegame;
const Endgame = GamePhase.Endgame;

export type TemplateEntry = {
  readonly source: string;
  readonly criteria: TemplateCriteria;
};

export const TEMPLATES: Readonly<Record<string, TemplateEntry>> = {
  // ----- Best -----------------------------------------------------------
  'best.general.1': {
    source: "{san} is the engine's top choice — clean and principled.",
    criteria: { classifications: [Best] },
  },
  'best.general.2': {
    source: 'Right on the money. {san} is exactly the move.',
    criteria: { classifications: [Best] },
  },
  'best.general.3': {
    source: "{san} matches Stockfish's first line. Hard to improve on.",
    criteria: { classifications: [Best] },
  },
  'best.general.4': {
    source: 'Precise. {san} is what the position was asking for.',
    criteria: { classifications: [Best] },
  },
  'best.with-check': {
    source: '{san} — engine top pick{?isCheck}, with check{/}.',
    criteria: { classifications: [Best] },
  },
  'best.with-capture': {
    source:
      "{san}{?isCapture} captures the {captured}{/}. The engine's first choice.",
    criteria: { classifications: [Best] },
  },
  'best.opening': {
    source: '{san} keeps your opening on solid ground — engine-approved.',
    criteria: { classifications: [Best], phases: [Opening] },
  },
  'best.middlegame': {
    source: '{san} is the strongest middlegame continuation here.',
    criteria: { classifications: [Best], phases: [Middlegame] },
  },
  'best.endgame': {
    source: '{san} holds the endgame technique together. Well found.',
    criteria: { classifications: [Best], phases: [Endgame] },
  },

  // ----- Sharp ----------------------------------------------------------
  'sharp.general.1': {
    source: 'Sharp! {san} sees a tactic the engine itself rates highly.',
    criteria: { classifications: [Sharp] },
  },
  'sharp.general.2': {
    source: '{san} is a sharp blow — a move most players walk right past.',
    criteria: { classifications: [Sharp] },
  },
  'sharp.general.3': {
    source:
      'A stunning find. {san} converts the position with surgical accuracy.',
    criteria: { classifications: [Sharp] },
  },
  'sharp.general.4': {
    source: 'Top engines reserve an exclamation mark for moves like {san}.',
    criteria: { classifications: [Sharp] },
  },
  'sharp.mate-setup': {
    source: '{san} sets up a forced mate. Sharp calculation.',
    criteria: { classifications: [Sharp] },
  },
  'sharp.fork': {
    source: '{san} is a sharp fork — the {piece} hits {forkTargets} at once.',
    criteria: { classifications: [Sharp], motifs: ['fork'] },
  },
  'sharp.discovered': {
    source:
      '{san} unleashes a sharp discovered attack — the resulting threat is decisive.',
    criteria: {
      classifications: [Sharp],
      motifs: ['discoveredAttack', 'discoveredCheck'],
    },
  },
  'sharp.endgame': {
    source:
      '{san} is a sharp endgame find — most players would never spot the resource.',
    criteria: { classifications: [Sharp], phases: [Endgame] },
  },

  // ----- Excellent ------------------------------------------------------
  'excellent.general.1': {
    source: "{san} is a strong move — almost as good as the engine's top pick.",
    criteria: { classifications: [Excellent] },
  },
  'excellent.general.2': {
    source: 'Solid. {san} keeps you on the right track.',
    criteria: { classifications: [Excellent] },
  },
  'excellent.general.3': {
    source: 'Excellent. {san} maintains your edge cleanly.',
    criteria: { classifications: [Excellent] },
  },
  'excellent.general.4': {
    source:
      "{san} is well-judged — only a hair behind the engine's first choice.",
    criteria: { classifications: [Excellent] },
  },
  'excellent.general.5': {
    source:
      "Nicely played. {san} is one of the engine's preferred continuations.",
    criteria: { classifications: [Excellent] },
  },
  'excellent.opening': {
    source:
      '{san} is a textbook opening choice — engine-approved and easy to follow up.',
    criteria: { classifications: [Excellent], phases: [Opening] },
  },
  'excellent.middlegame': {
    source: '{san} steers the middlegame in the right direction.',
    criteria: { classifications: [Excellent], phases: [Middlegame] },
  },
  'excellent.endgame': {
    source: '{san} keeps your endgame technique sharp. Stockfish would nod.',
    criteria: { classifications: [Excellent], phases: [Endgame] },
  },

  // ----- Good -----------------------------------------------------------
  'good.general.1': {
    source:
      "{san} is a perfectly reasonable move — not the engine's pick, but not far off.",
    criteria: { classifications: [Good] },
  },
  'good.general.2': {
    source: '{san} is fine. The position holds.',
    criteria: { classifications: [Good] },
  },
  'good.general.3': {
    source: 'A safe, sensible {san}. The evaluation barely moves.',
    criteria: { classifications: [Good] },
  },
  'good.general.4': {
    source:
      '{san} works. Stockfish prefers {bestSan?something else}, but the difference is small.',
    criteria: { classifications: [Good] },
  },
  'good.general.5': {
    source: 'Good enough. {san} keeps the structure intact.',
    criteria: { classifications: [Good] },
  },
  'good.opening': {
    source:
      '{san} is a sound opening move — solid development without overextending.',
    criteria: { classifications: [Good], phases: [Opening] },
  },
  'good.endgame': {
    source: '{san} is a solid endgame move — patient, no risks taken.',
    criteria: { classifications: [Good], phases: [Endgame] },
  },

  // ----- Inaccuracy -----------------------------------------------------
  'inaccuracy.general.1': {
    source: '{san} is a small slip. {bestSan} would have kept more.',
    criteria: { classifications: [Inaccuracy] },
  },
  'inaccuracy.general.2': {
    source: "Inaccurate — {san} gives back a bit of what you'd built up.",
    criteria: { classifications: [Inaccuracy] },
  },
  'inaccuracy.general.3': {
    source: '{san} drifts. Engine prefers {bestSan} for cleaner play.',
    criteria: { classifications: [Inaccuracy] },
  },
  'inaccuracy.general.4': {
    source: 'Not the cleanest — {bestSan} was the more accurate continuation.',
    criteria: { classifications: [Inaccuracy] },
  },
  'inaccuracy.general.5': {
    source:
      '{san} costs roughly {cpLoss} centipawns. Look at {bestSan} next time.',
    criteria: { classifications: [Inaccuracy] },
  },
  'inaccuracy.optional-best': {
    source: '{san} is a small slip{?bestSan}. Stronger was {bestSan}{/}.',
    criteria: { classifications: [Inaccuracy] },
  },
  'inaccuracy.with-mate-thread': {
    source:
      '{san} is inaccurate — it allows the opponent to threaten {threatSan}, costing tempo.',
    criteria: { classifications: [Inaccuracy] },
  },
  'inaccuracy.opening': {
    source:
      '{san} is a slightly off-tempo opening move; {bestSan} is more standard.',
    criteria: { classifications: [Inaccuracy], phases: [Opening] },
  },
  'inaccuracy.middlegame': {
    source:
      'Middlegame inaccuracy. {bestSan} kept the initiative; {san} loosens things.',
    criteria: { classifications: [Inaccuracy], phases: [Middlegame] },
  },
  'inaccuracy.endgame': {
    source: 'Small endgame slip — {bestSan} converts more cleanly than {san}.',
    criteria: { classifications: [Inaccuracy], phases: [Endgame] },
  },

  // ----- Mistake --------------------------------------------------------
  'mistake.general.1': {
    source: '{san} is a mistake — about {cpLoss} centipawns lost to {bestSan}.',
    criteria: { classifications: [Mistake] },
  },
  'mistake.general.2': {
    source:
      "That's a mistake. {bestSan} was the right idea; {san} hands back ground.",
    criteria: { classifications: [Mistake] },
  },
  'mistake.general.3': {
    source:
      '{san} misses the point of the position. {bestSan} was much stronger.',
    criteria: { classifications: [Mistake] },
  },
  'mistake.general.4': {
    source:
      'Mistake. The eval shifts from {evalBefore} to {evalAfter} after {san}.',
    criteria: { classifications: [Mistake] },
  },
  'mistake.general.5': {
    source:
      '{san} drops the thread. {bestSan} would have kept things on course.',
    criteria: { classifications: [Mistake] },
  },
  'mistake.attacked-square': {
    source:
      '{san} weakens {attackedSquare}. The opponent will pressure it; {bestSan} kept the square covered.',
    criteria: { classifications: [Mistake] },
  },
  'mistake.fork': {
    source:
      '{san} walks into a fork. {bestSan} sidesteps the {forkTargets} double-hit.',
    criteria: { classifications: [Mistake], motifs: ['fork'] },
  },
  'mistake.pin': {
    source:
      '{san} leaves your {pinnedPiece} pinned to the {pinTo}. {bestSan} avoids the pin.',
    criteria: { classifications: [Mistake], motifs: ['pin'] },
  },
  'mistake.hanging': {
    source:
      '{san} leaves the {hangingPiece} on {hangingSquare} hanging. {bestSan} keeps it defended.',
    criteria: { classifications: [Mistake], motifs: ['hanging'] },
  },
  'mistake.opening': {
    source: 'Opening mistake — {bestSan} follows known theory; {san} strays.',
    criteria: { classifications: [Mistake], phases: [Opening] },
  },
  'mistake.middlegame': {
    source: '{san} is a middlegame misstep. The plan called for {bestSan}.',
    criteria: { classifications: [Mistake], phases: [Middlegame] },
  },
  'mistake.endgame': {
    source: 'Endgame mistake — {bestSan} converts; {san} loses the technique.',
    criteria: { classifications: [Mistake], phases: [Endgame] },
  },

  // ----- Blunder (general) ---------------------------------------------
  'blunder.general.1': {
    source:
      'Blunder. {san} drops {cpLoss} centipawns; {bestSan} held the position.',
    criteria: { classifications: [Blunder] },
  },
  'blunder.general.2': {
    source:
      '{san} is a blunder. After {bestSan} you were comfortable; now the eval swings to {evalAfter}.',
    criteria: { classifications: [Blunder] },
  },
  'blunder.general.3': {
    source: 'Tough one — {san} is a clear blunder. {bestSan} was needed.',
    criteria: { classifications: [Blunder] },
  },
  'blunder.general.4': {
    source:
      'Blunder. {san} loses material outright; {bestSan} kept things alive.',
    criteria: { classifications: [Blunder] },
  },
  'blunder.general.5': {
    source:
      "That's a blunder. {bestSan} held; {san} gives the opponent a winning position.",
    criteria: { classifications: [Blunder] },
  },
  'blunder.general.6': {
    source: '{san} hangs the game. {bestSan} would have kept you in the fight.',
    criteria: { classifications: [Blunder] },
  },
  'blunder.mate-walk': {
    source:
      '{san} walks into a forced mate. {bestSan} was the only saving move.',
    criteria: { classifications: [Blunder] },
  },

  // ----- Blunder (hanging) ---------------------------------------------
  'blunder.hanging.1': {
    source:
      '{san} leaves the {hangingPiece} on {hangingSquare} en prise. The opponent picks it off for free.',
    criteria: { classifications: [Blunder], motifs: ['hanging'] },
  },
  'blunder.hanging.2': {
    source:
      'Blunder — {san} hangs your {hangingPiece}. {bestSan} kept it defended.',
    criteria: { classifications: [Blunder], motifs: ['hanging'] },
  },
  'blunder.hanging.3': {
    source:
      'Free piece for the opponent: the {hangingPiece} on {hangingSquare} has no defender after {san}.',
    criteria: { classifications: [Blunder], motifs: ['hanging'] },
  },
  'blunder.hanging.4': {
    source:
      'After {san}, the {hangingPiece} simply drops. {bestSan} was essential.',
    criteria: { classifications: [Blunder], motifs: ['hanging'] },
  },

  // ----- Blunder (fork) ------------------------------------------------
  'blunder.fork.1': {
    source:
      '{san} runs into a fork — {forkTargets} are both hit. Material loss is unavoidable.',
    criteria: { classifications: [Blunder], motifs: ['fork'] },
  },
  'blunder.fork.2': {
    source:
      'Blunder: the opponent forks {forkTargets} with the natural reply. {bestSan} avoids the double attack.',
    criteria: { classifications: [Blunder], motifs: ['fork'] },
  },
  'blunder.fork.3': {
    source:
      '{san} walks straight into a forking tactic. Two pieces under fire at once.',
    criteria: { classifications: [Blunder], motifs: ['fork'] },
  },
  'blunder.fork.4': {
    source:
      "After {san}, the opponent's fork wins material; {bestSan} kept the pieces apart.",
    criteria: { classifications: [Blunder], motifs: ['fork'] },
  },

  // ----- Blunder (pin) -------------------------------------------------
  'blunder.pin.1': {
    source:
      '{san} pins your {pinnedPiece} to the {pinTo}. The piece is paralysed and the opponent can pile on.',
    criteria: { classifications: [Blunder], motifs: ['pin'] },
  },
  'blunder.pin.2': {
    source:
      'Blunder: the {pinnedPiece} is now pinned and cannot move without losing the {pinTo}.',
    criteria: { classifications: [Blunder], motifs: ['pin'] },
  },
  'blunder.pin.3': {
    source:
      'After {san}, the pin on the {pinnedPiece} costs you material. {bestSan} kept the line clear.',
    criteria: { classifications: [Blunder], motifs: ['pin'] },
  },

  // ----- Blunder (skewer) ----------------------------------------------
  'blunder.skewer.1': {
    source:
      'Blunder — {san} allows a skewer through your {skeweredPiece}. The piece behind it falls.',
    criteria: { classifications: [Blunder], motifs: ['skewer'] },
  },
  'blunder.skewer.2': {
    source:
      '{san} lines up your pieces for a skewer. Once the front piece moves, the rear is lost.',
    criteria: { classifications: [Blunder], motifs: ['skewer'] },
  },
  'blunder.skewer.3': {
    source:
      'Skewered. After {san} the opponent forces your {skeweredPiece} to step aside, dropping material.',
    criteria: { classifications: [Blunder], motifs: ['skewer'] },
  },

  // ----- Blunder (back rank) -------------------------------------------
  'blunder.backRank.1': {
    source:
      'Back-rank blunder — {san} leaves the king with no escape squares; mate is in the air.',
    criteria: { classifications: [Blunder], motifs: ['backRank'] },
  },
  'blunder.backRank.2': {
    source:
      '{san} ignores a back-rank threat. The {backRankPiece} delivers mate or wins decisive material.',
    criteria: { classifications: [Blunder], motifs: ['backRank'] },
  },
  'blunder.backRank.3': {
    source:
      'Blunder: with the king pinned to the back rank, {san} hands the opponent a winning combination.',
    criteria: { classifications: [Blunder], motifs: ['backRank'] },
  },

  // ----- Blunder (discovered) ------------------------------------------
  'blunder.discoveredCheck.1': {
    source: '{san} allows a discovered check that wins material on the side.',
    criteria: { classifications: [Blunder], motifs: ['discoveredCheck'] },
  },
  'blunder.discoveredCheck.2': {
    source:
      "Blunder: the opponent's next move uncovers a check while attacking another piece. Disaster.",
    criteria: { classifications: [Blunder], motifs: ['discoveredCheck'] },
  },
  'blunder.discoveredCheck.3': {
    source:
      'After {san}, a discovered check forces you to respond — and meanwhile material falls.',
    criteria: { classifications: [Blunder], motifs: ['discoveredCheck'] },
  },
  'blunder.discoveredAttack.1': {
    source:
      '{san} steps into a discovered attack — moving one piece reveals another with a winning hit.',
    criteria: { classifications: [Blunder], motifs: ['discoveredAttack'] },
  },
  'blunder.discoveredAttack.2': {
    source:
      'Discovered-attack blunder. {bestSan} kept the line of fire blocked.',
    criteria: { classifications: [Blunder], motifs: ['discoveredAttack'] },
  },

  // ----- Blunder (double attack) ---------------------------------------
  'blunder.doubleAttack.1': {
    source:
      "{san} sets up a double attack against you — two threats, and one move can't meet both.",
    criteria: { classifications: [Blunder], motifs: ['doubleAttack'] },
  },
  'blunder.doubleAttack.2': {
    source:
      "Blunder: the opponent's reply double-attacks and wins material no matter how you respond.",
    criteria: { classifications: [Blunder], motifs: ['doubleAttack'] },
  },
  'blunder.doubleAttack.3': {
    source:
      'After {san}, two pieces are simultaneously hit. {bestSan} avoided the geometry.',
    criteria: { classifications: [Blunder], motifs: ['doubleAttack'] },
  },

  // ----- Blunder (removing defender / overloaded) ----------------------
  'blunder.removingDefender.1': {
    source:
      '{san} loses the defender of {defendedSquare}. Once the {defendedPiece} falls, the position collapses.',
    criteria: { classifications: [Blunder], motifs: ['removingDefender'] },
  },
  'blunder.removingDefender.2': {
    source:
      'Blunder: the opponent removes your defender and harvests the {defendedPiece} on {defendedSquare}.',
    criteria: { classifications: [Blunder], motifs: ['removingDefender'] },
  },
  'blunder.overloaded.1': {
    source:
      "{san} overloads your defender — it can't cover everything. Material will fall.",
    criteria: { classifications: [Blunder], motifs: ['overloaded'] },
  },
  'blunder.overloaded.2': {
    source:
      'Blunder: the {defendedPiece} is asked to defend two things at once and gives way.',
    criteria: { classifications: [Blunder], motifs: ['overloaded'] },
  },

  // ----- Blunder (per phase) -------------------------------------------
  'blunder.opening.1': {
    source:
      'Opening blunder — {san} drops a piece before development is even complete.',
    criteria: { classifications: [Blunder], phases: [Opening] },
  },
  'blunder.opening.2': {
    source:
      '{san} is a serious opening blunder. The position is already losing.',
    criteria: { classifications: [Blunder], phases: [Opening] },
  },
  'blunder.endgame.1': {
    source:
      'Endgame blunder. {bestSan} held the draw; {san} loses the technique.',
    criteria: { classifications: [Blunder], phases: [Endgame] },
  },
  'blunder.endgame.2': {
    source: '{san} throws away the endgame. A precise {bestSan} was needed.',
    criteria: { classifications: [Blunder], phases: [Endgame] },
  },

  // ----- Miss -----------------------------------------------------------
  'miss.general.1': {
    source:
      'Missed. {san} works, but {bestSan} was a much stronger continuation.',
    criteria: { classifications: [Miss] },
  },
  'miss.general.2': {
    source: 'You missed the resource — {bestSan} forces a winning position.',
    criteria: { classifications: [Miss] },
  },
  'miss.general.3': {
    source: 'A missed opportunity. {bestSan} was the killer here.',
    criteria: { classifications: [Miss] },
  },
  'miss.general.4': {
    source: 'Close — {san} holds the edge, but {bestSan} converts it cleanly.',
    criteria: { classifications: [Miss] },
  },
  'miss.mate.1': {
    source: 'Missed mate! {bestSan} starts a forced mate sequence.',
    criteria: { classifications: [Miss] },
  },
  'miss.mate.2': {
    source: 'There was mate on the board — {bestSan} delivered it.',
    criteria: { classifications: [Miss] },
  },
  'miss.mate.3': {
    source:
      'You had a forced mate after {bestSan}; {san} lets the opponent off the hook.',
    criteria: { classifications: [Miss] },
  },
  'miss.mate.4': {
    source: 'Forced mate slipped away. {bestSan} would have wrapped it up.',
    criteria: { classifications: [Miss] },
  },

  // ----- Book -----------------------------------------------------------
  'book.general.1': {
    source: '{san} is a known opening move — straight from theory.',
    criteria: { classifications: [Book] },
  },
  'book.general.2': {
    source: 'Book move. {san} is well-trodden and reliable.',
    criteria: { classifications: [Book] },
  },
  'book.general.3': {
    source: 'Theory: {san} is the standard continuation here.',
    criteria: { classifications: [Book] },
  },
  'book.general.4': {
    source: '{san} keeps the game in mainline territory.',
    criteria: { classifications: [Book] },
  },
  'book.named.1': {
    source: '{san} — straight out of the {opening}.',
    criteria: { classifications: [Book] },
  },
  'book.named.2': {
    source: '{san} continues the {opening} ({ecoCode}).',
    criteria: { classifications: [Book] },
  },
  'book.named.3': {
    source: 'Theory: {san} is the standard reply in the {opening}.',
    criteria: { classifications: [Book] },
  },
};

/**
 * Wire the entire library into a fresh `TemplateRegistry` and
 * `TemplateSelector`. Call once at app startup. Throws if either store
 * already contains a colliding id.
 */
export function loadLibrary(
  registry: TemplateRegistry,
  selector: TemplateSelector,
): void {
  const sources: Record<string, string> = {};
  for (const [id, entry] of Object.entries(TEMPLATES)) {
    sources[id] = entry.source;
  }
  registry.loadFromRecord(sources);
  for (const [id, entry] of Object.entries(TEMPLATES)) {
    selector.add(id, entry.criteria);
  }
}
