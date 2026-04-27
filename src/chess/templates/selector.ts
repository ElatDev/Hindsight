import type { Classification } from '../classify';
import type { GamePhase } from '../positional/gamePhase';

/**
 * Canonical motif tags the explanation system reasons about. Stable strings
 * because templates encode them in their criteria — renaming one breaks
 * every template referencing it. Keep this list in sync with the modules in
 * `src/chess/motifs/`.
 */
export const MOTIF_TAGS = [
  'hanging',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'discoveredCheck',
  'doubleAttack',
  'backRank',
  'overloaded',
  'removingDefender',
] as const;

export type MotifTag = (typeof MOTIF_TAGS)[number];

/**
 * Constraints attached to a template at registration time. All fields are
 * optional — an empty criteria object is a wildcard that matches any context
 * (lowest specificity, last to be picked among ties). The selector treats
 * each set field as a requirement:
 *
 *  - `classifications` / `phases`: ctx value must be one of the listed.
 *  - `motifs`: ctx motifs must include at least one of the listed.
 *  - `excludeMotifs`: ctx motifs must include none of the listed.
 */
export type TemplateCriteria = {
  readonly classifications?: readonly Classification[];
  readonly motifs?: readonly MotifTag[];
  readonly excludeMotifs?: readonly MotifTag[];
  readonly phases?: readonly GamePhase[];
};

/** The runtime side: the move we're explaining. */
export type SelectionContext = {
  readonly classification: Classification;
  /** Motifs detected at the position the player faced. */
  readonly motifs: readonly MotifTag[];
  readonly phase: GamePhase;
};

/** Source of randomness for `pick()`. Returns a number in `[0, 1)`. */
export type Rng = () => number;

/**
 * Per-criterion weight contributing to a rule's specificity score. Picked so
 * motif-tagged rules outrank classification-only rules, which outrank
 * phase-only rules, with `excludeMotifs` adding a small bump (it makes a
 * rule pickier without making it more specific in the usual sense).
 */
const SPECIFICITY_WEIGHTS = {
  motifs: 3,
  classifications: 2,
  excludeMotifs: 1,
  phases: 1,
} as const;

type Rule = {
  readonly id: string;
  readonly criteria: TemplateCriteria;
  readonly specificity: number;
};

/**
 * Picks template ids that match a given runtime context. Decoupled from
 * `TemplateRegistry` on purpose: tests can exercise selection without ever
 * parsing template sources, and consumers free to keep registration data in
 * a different store than rendering data.
 *
 * Ordering rules for `candidates()`:
 *  1. Higher specificity first (more required constraints satisfied).
 *  2. Ties broken alphabetically by id, for deterministic output.
 *
 * `pick()` adds variety by random-sampling among the highest-specificity
 * tier — never sacrificing specificity for variety.
 */
export class TemplateSelector {
  private readonly rules = new Map<string, Rule>();

  /** Add a template id with its match criteria. Throws if `id` is already set. */
  add(id: string, criteria: TemplateCriteria = {}): void {
    if (this.rules.has(id)) {
      throw new Error(`Template id '${id}' is already in the selector`);
    }
    this.rules.set(id, {
      id,
      criteria,
      specificity: scoreCriteria(criteria),
    });
  }

  has(id: string): boolean {
    return this.rules.has(id);
  }

  size(): number {
    return this.rules.size;
  }

  clear(): void {
    this.rules.clear();
  }

  /**
   * All template ids whose criteria match `ctx`, sorted by specificity
   * desc, then by id asc. Returns an empty array when nothing matches.
   */
  candidates(ctx: SelectionContext): readonly string[] {
    return this.matchingTiers(ctx).flatMap((tier) => tier.ids);
  }

  /**
   * Pick a single matching id at random from the top-specificity tier.
   * Returns `null` when nothing matches. The default RNG is `Math.random`;
   * tests inject a deterministic alternative.
   */
  pick(ctx: SelectionContext, rng: Rng = Math.random): string | null {
    const tiers = this.matchingTiers(ctx);
    if (tiers.length === 0) return null;
    const top = tiers[0];
    if (top.ids.length === 0) return null;
    const r = rng();
    if (!Number.isFinite(r) || r < 0 || r >= 1) {
      throw new RangeError(
        `Rng returned ${r}; must be a finite number in [0, 1)`,
      );
    }
    const idx = Math.floor(r * top.ids.length);
    return top.ids[idx];
  }

  private matchingTiers(
    ctx: SelectionContext,
  ): { score: number; ids: string[] }[] {
    const matches = Array.from(this.rules.values()).filter((rule) =>
      ruleMatches(rule.criteria, ctx),
    );
    if (matches.length === 0) return [];

    matches.sort((a, b) => {
      if (a.specificity !== b.specificity) return b.specificity - a.specificity;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const tiers: { score: number; ids: string[] }[] = [];
    for (const m of matches) {
      const last = tiers[tiers.length - 1];
      if (last && last.score === m.specificity) {
        last.ids.push(m.id);
      } else {
        tiers.push({ score: m.specificity, ids: [m.id] });
      }
    }
    return tiers;
  }
}

function ruleMatches(c: TemplateCriteria, ctx: SelectionContext): boolean {
  if (c.classifications && !c.classifications.includes(ctx.classification)) {
    return false;
  }
  if (c.phases && !c.phases.includes(ctx.phase)) {
    return false;
  }
  if (c.motifs && c.motifs.length > 0) {
    const present = ctx.motifs;
    if (!c.motifs.some((m) => present.includes(m))) return false;
  }
  if (c.excludeMotifs && c.excludeMotifs.length > 0) {
    if (c.excludeMotifs.some((m) => ctx.motifs.includes(m))) return false;
  }
  return true;
}

function scoreCriteria(c: TemplateCriteria): number {
  let s = 0;
  if (c.motifs && c.motifs.length > 0) s += SPECIFICITY_WEIGHTS.motifs;
  if (c.classifications && c.classifications.length > 0) {
    s += SPECIFICITY_WEIGHTS.classifications;
  }
  if (c.excludeMotifs && c.excludeMotifs.length > 0) {
    s += SPECIFICITY_WEIGHTS.excludeMotifs;
  }
  if (c.phases && c.phases.length > 0) s += SPECIFICITY_WEIGHTS.phases;
  return s;
}
