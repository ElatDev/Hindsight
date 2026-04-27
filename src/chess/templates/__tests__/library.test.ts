import { describe, expect, it } from 'vitest';
import { Classification } from '../../classify';
import { GamePhase } from '../../positional/gamePhase';
import { TemplateRegistry } from '../registry';
import {
  TemplateSelector,
  type SelectionContext,
  type MotifTag,
} from '../selector';
import { TEMPLATES, loadLibrary } from '../library';

/**
 * Kitchen-sink context: every variable any template might reference,
 * populated with sensible non-empty values. Templates render against this
 * to confirm parse + render success regardless of which variables they pull.
 */
const FULL_CTX = {
  mover: 'White',
  opponent: 'Black',
  san: 'Nxe5',
  piece: 'knight',
  from: 'f3',
  to: 'e5',
  captured: 'pawn',
  isCapture: true,
  isCheck: true,
  cpLoss: 220,
  bestSan: 'd4',
  bestPiece: 'pawn',
  bestTo: 'd4',
  evalBefore: '+0.4',
  evalAfter: '-1.2',
  phase: 'middlegame',
  wasMating: true,
  nowBeingMated: true,
  mateIn: 3,
  mateInAfter: 2,
  forkTargets: 'queen and rook',
  pinnedPiece: 'knight',
  pinTo: 'queen',
  skeweredPiece: 'rook',
  skeweredBy: 'bishop',
  hangingPiece: 'bishop',
  hangingSquare: 'c5',
  attackerPiece: 'rook',
  defendedPiece: 'knight',
  defendedSquare: 'd4',
  backRankPiece: 'rook',
  threatSan: 'Qxh7#',
  attackedSquare: 'h7',
  opening: 'Sicilian Defense, Najdorf Variation',
  ecoCode: 'B90',
} as const;

/** Same shape but with every flag flipped — exercises {?!flag} branches. */
const FALSY_FLAGS_CTX = {
  ...FULL_CTX,
  isCapture: false,
  isCheck: false,
  wasMating: false,
  nowBeingMated: false,
  captured: '',
};

const freshLibrary = (): {
  registry: TemplateRegistry;
  selector: TemplateSelector;
} => {
  const registry = new TemplateRegistry();
  const selector = new TemplateSelector();
  loadLibrary(registry, selector);
  return { registry, selector };
};

describe('Template library — bulk load', () => {
  it('registers 100+ templates without errors', () => {
    const { registry, selector } = freshLibrary();
    expect(registry.size()).toBeGreaterThanOrEqual(100);
    expect(selector.size()).toBe(registry.size());
  });

  it('every TEMPLATES id is registered with the same set of ids in both stores', () => {
    const { registry } = freshLibrary();
    expect(registry.ids()).toEqual([...Object.keys(TEMPLATES)].sort());
  });

  it('throws cleanly if loaded into a registry that already has one of the ids', () => {
    const registry = new TemplateRegistry();
    const selector = new TemplateSelector();
    const firstId = Object.keys(TEMPLATES)[0];
    registry.register(firstId, 'pre-existing');
    expect(() => loadLibrary(registry, selector)).toThrow(
      /already registered/i,
    );
  });
});

describe('Template library — render every template', () => {
  it.each(Object.keys(TEMPLATES))(
    'renders %s against the full context',
    (id) => {
      const { registry } = freshLibrary();
      const out = registry.render(id, FULL_CTX);
      expect(out).toMatch(/\S/);
    },
  );

  it.each(Object.keys(TEMPLATES))(
    'renders %s against the falsy-flags context',
    (id) => {
      const { registry } = freshLibrary();
      const out = registry.render(id, FALSY_FLAGS_CTX);
      expect(out).toMatch(/\S/);
    },
  );

  it('rendered output never contains stray DSL syntax', () => {
    const { registry } = freshLibrary();
    for (const id of Object.keys(TEMPLATES)) {
      const out = registry.render(id, FULL_CTX);
      // Unrendered braces or `{?` would mean the parser missed a token.
      expect(out, `template ${id}`).not.toMatch(/\{[?!:/]/);
    }
  });
});

/**
 * Realistic selection contexts representing the inputs the orchestration
 * layer will produce. Combinatorial across classifications × phases × motif
 * sets — comprehensive enough to be sure every template has at least one
 * "real" position where it would be picked.
 */
const SAMPLES: readonly SelectionContext[] = (() => {
  const phases = Object.values(GamePhase);
  const classifications = Object.values(Classification);
  const motifSets: readonly MotifTag[][] = [
    [],
    ['hanging'],
    ['fork'],
    ['pin'],
    ['skewer'],
    ['backRank'],
    ['discoveredCheck'],
    ['discoveredAttack'],
    ['doubleAttack'],
    ['removingDefender'],
    ['overloaded'],
  ];
  const out: SelectionContext[] = [];
  for (const classification of classifications) {
    for (const phase of phases) {
      for (const motifs of motifSets) {
        out.push({ classification, phase, motifs });
      }
    }
  }
  return out;
})();

describe('Template library — selector coverage over realistic contexts', () => {
  it('every classification × phase context yields at least one candidate', () => {
    const { selector } = freshLibrary();
    const wildcardOnlyContexts: SelectionContext[] = [];
    for (const ctx of SAMPLES) {
      // Every non-Sharp / non-Book classification with no motifs should
      // have explicit candidates; Sharp/Book without motifs still have
      // their general templates. So every sample should produce ≥ 1.
      const candidates = selector.candidates(ctx);
      if (candidates.length === 0) wildcardOnlyContexts.push(ctx);
    }
    expect(wildcardOnlyContexts).toEqual([]);
  });

  it('every template is selected for at least one sample context', () => {
    const { selector } = freshLibrary();
    const seen = new Set<string>();
    for (const ctx of SAMPLES) {
      for (const id of selector.candidates(ctx)) seen.add(id);
    }
    const missing = Object.keys(TEMPLATES).filter((id) => !seen.has(id));
    expect(missing).toEqual([]);
  });

  it('selected template renders cleanly for the context that selected it', () => {
    const { registry, selector } = freshLibrary();
    for (const ctx of SAMPLES) {
      for (const id of selector.candidates(ctx)) {
        // FULL_CTX is a superset of any context's required vars; rendering
        // a selected template against it must always succeed.
        expect(
          () => registry.render(id, FULL_CTX),
          `${id} for ${JSON.stringify(ctx)}`,
        ).not.toThrow();
      }
    }
  });

  it('pick() returns a registered id for every sample', () => {
    const { registry, selector } = freshLibrary();
    let i = 0;
    const rng = () => {
      const v = (i % 17) / 17;
      i += 1;
      return v;
    };
    for (const ctx of SAMPLES) {
      const picked = selector.pick(ctx, rng);
      expect(picked, JSON.stringify(ctx)).not.toBeNull();
      expect(registry.has(picked as string)).toBe(true);
    }
  });
});

describe('Template library — motif-tagged templates only fire with their motif', () => {
  // Spot-check that the motif criteria actually constrain selection: a
  // motif-tagged template should never appear in a candidate list whose
  // motifs[] is empty.
  it.each([
    ['blunder.fork.1', 'fork' as MotifTag],
    ['blunder.hanging.1', 'hanging' as MotifTag],
    ['blunder.pin.1', 'pin' as MotifTag],
    ['blunder.skewer.1', 'skewer' as MotifTag],
    ['blunder.backRank.1', 'backRank' as MotifTag],
    ['blunder.discoveredCheck.1', 'discoveredCheck' as MotifTag],
    ['blunder.doubleAttack.1', 'doubleAttack' as MotifTag],
    ['blunder.removingDefender.1', 'removingDefender' as MotifTag],
    ['blunder.overloaded.1', 'overloaded' as MotifTag],
  ])('%s only appears when %s is present', (id, motif) => {
    const { selector } = freshLibrary();
    const without: SelectionContext = {
      classification: Classification.Blunder,
      motifs: [],
      phase: GamePhase.Middlegame,
    };
    const withMotif: SelectionContext = { ...without, motifs: [motif] };
    expect(selector.candidates(without)).not.toContain(id);
    expect(selector.candidates(withMotif)).toContain(id);
  });
});
