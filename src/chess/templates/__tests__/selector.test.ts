import { describe, expect, it } from 'vitest';
import { Classification } from '../../classify';
import { GamePhase } from '../../positional/gamePhase';
import {
  TemplateSelector,
  type MotifTag,
  type SelectionContext,
} from '../selector';

const ctx = (over: Partial<SelectionContext> = {}): SelectionContext => ({
  classification: Classification.Blunder,
  motifs: [],
  phase: GamePhase.Middlegame,
  ...over,
});

describe('TemplateSelector — empty / wildcard', () => {
  it('returns an empty list when no rules are registered', () => {
    const s = new TemplateSelector();
    expect(s.candidates(ctx())).toEqual([]);
    expect(s.pick(ctx())).toBeNull();
  });

  it('a wildcard rule matches every context', () => {
    const s = new TemplateSelector();
    s.add('wild');
    expect(s.candidates(ctx())).toEqual(['wild']);
    expect(s.candidates(ctx({ classification: Classification.Best }))).toEqual([
      'wild',
    ]);
  });
});

describe('TemplateSelector — classification filter', () => {
  it('matches when ctx.classification is in the rule list', () => {
    const s = new TemplateSelector();
    s.add('blunder.x', { classifications: [Classification.Blunder] });
    expect(
      s.candidates(ctx({ classification: Classification.Blunder })),
    ).toEqual(['blunder.x']);
  });

  it('rejects when ctx.classification is not in the rule list', () => {
    const s = new TemplateSelector();
    s.add('blunder.x', { classifications: [Classification.Blunder] });
    expect(s.candidates(ctx({ classification: Classification.Best }))).toEqual(
      [],
    );
  });

  it('matches when classifications lists multiple options', () => {
    const s = new TemplateSelector();
    s.add('bad', {
      classifications: [Classification.Mistake, Classification.Blunder],
    });
    expect(
      s.candidates(ctx({ classification: Classification.Mistake })),
    ).toEqual(['bad']);
    expect(
      s.candidates(ctx({ classification: Classification.Blunder })),
    ).toEqual(['bad']);
    expect(s.candidates(ctx({ classification: Classification.Good }))).toEqual(
      [],
    );
  });
});

describe('TemplateSelector — motif filter', () => {
  it('matches when at least one required motif is present', () => {
    const s = new TemplateSelector();
    s.add('forky', { motifs: ['fork'] });
    expect(s.candidates(ctx({ motifs: ['fork'] }))).toEqual(['forky']);
    expect(s.candidates(ctx({ motifs: ['pin', 'fork'] }))).toEqual(['forky']);
  });

  it('rejects when no required motifs are present', () => {
    const s = new TemplateSelector();
    s.add('forky', { motifs: ['fork'] });
    expect(s.candidates(ctx({ motifs: ['pin'] }))).toEqual([]);
    expect(s.candidates(ctx({ motifs: [] }))).toEqual([]);
  });

  it('matches when ctx has any of multiple required motifs', () => {
    const s = new TemplateSelector();
    s.add('tactic', { motifs: ['fork', 'pin', 'skewer'] });
    expect(s.candidates(ctx({ motifs: ['skewer'] }))).toEqual(['tactic']);
  });
});

describe('TemplateSelector — excludeMotifs filter', () => {
  it('rejects when an excluded motif is present', () => {
    const s = new TemplateSelector();
    s.add('quietBlunder', { excludeMotifs: ['fork', 'pin'] });
    expect(s.candidates(ctx({ motifs: ['fork'] }))).toEqual([]);
    expect(s.candidates(ctx({ motifs: ['hanging'] }))).toEqual([
      'quietBlunder',
    ]);
    expect(s.candidates(ctx({ motifs: [] }))).toEqual(['quietBlunder']);
  });
});

describe('TemplateSelector — phase filter', () => {
  it('matches only listed phases', () => {
    const s = new TemplateSelector();
    s.add('endgame.x', { phases: [GamePhase.Endgame] });
    expect(s.candidates(ctx({ phase: GamePhase.Endgame }))).toEqual([
      'endgame.x',
    ]);
    expect(s.candidates(ctx({ phase: GamePhase.Middlegame }))).toEqual([]);
  });
});

describe('TemplateSelector — combined filters', () => {
  it('all listed constraints must pass', () => {
    const s = new TemplateSelector();
    s.add('blunder.fork.mid', {
      classifications: [Classification.Blunder],
      motifs: ['fork'],
      phases: [GamePhase.Middlegame],
    });
    expect(
      s.candidates(
        ctx({
          classification: Classification.Blunder,
          motifs: ['fork'],
          phase: GamePhase.Middlegame,
        }),
      ),
    ).toEqual(['blunder.fork.mid']);
    // Wrong classification.
    expect(
      s.candidates(
        ctx({
          classification: Classification.Best,
          motifs: ['fork'],
          phase: GamePhase.Middlegame,
        }),
      ),
    ).toEqual([]);
    // Wrong motif.
    expect(
      s.candidates(
        ctx({
          classification: Classification.Blunder,
          motifs: ['pin'],
          phase: GamePhase.Middlegame,
        }),
      ),
    ).toEqual([]);
    // Wrong phase.
    expect(
      s.candidates(
        ctx({
          classification: Classification.Blunder,
          motifs: ['fork'],
          phase: GamePhase.Endgame,
        }),
      ),
    ).toEqual([]);
  });
});

describe('TemplateSelector — specificity ordering', () => {
  it('motif-specific rules outrank classification-only rules', () => {
    const s = new TemplateSelector();
    s.add('general.blunder', { classifications: [Classification.Blunder] });
    s.add('blunder.fork', {
      classifications: [Classification.Blunder],
      motifs: ['fork'],
    });
    const out = s.candidates(
      ctx({ classification: Classification.Blunder, motifs: ['fork'] }),
    );
    expect(out).toEqual(['blunder.fork', 'general.blunder']);
  });

  it('classification-only rules outrank pure phase rules', () => {
    const s = new TemplateSelector();
    s.add('any.endgame', { phases: [GamePhase.Endgame] });
    s.add('blunder.any', { classifications: [Classification.Blunder] });
    const out = s.candidates(
      ctx({ classification: Classification.Blunder, phase: GamePhase.Endgame }),
    );
    expect(out).toEqual(['blunder.any', 'any.endgame']);
  });

  it('alphabetical tie-break when specificity is equal', () => {
    const s = new TemplateSelector();
    s.add('zeta', { classifications: [Classification.Blunder] });
    s.add('alpha', { classifications: [Classification.Blunder] });
    s.add('mid', { classifications: [Classification.Blunder] });
    expect(
      s.candidates(ctx({ classification: Classification.Blunder })),
    ).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('places wildcard rules last', () => {
    const s = new TemplateSelector();
    s.add('wild');
    s.add('blunder.specific', { classifications: [Classification.Blunder] });
    const out = s.candidates(ctx({ classification: Classification.Blunder }));
    expect(out).toEqual(['blunder.specific', 'wild']);
  });
});

describe('TemplateSelector — pick()', () => {
  it('returns null when no candidates match', () => {
    const s = new TemplateSelector();
    s.add('forky', { motifs: ['fork'] });
    expect(s.pick(ctx({ motifs: [] }))).toBeNull();
  });

  it('only picks from the top-specificity tier', () => {
    const s = new TemplateSelector();
    // Top tier: motif + classification (specificity 5).
    s.add('top.a', {
      classifications: [Classification.Blunder],
      motifs: ['fork'],
    });
    s.add('top.b', {
      classifications: [Classification.Blunder],
      motifs: ['fork'],
    });
    // Lower tier: classification only.
    s.add('mid', { classifications: [Classification.Blunder] });

    const c = ctx({ classification: Classification.Blunder, motifs: ['fork'] });

    // Sample many times — should never see "mid".
    const seen = new Set<string>();
    let i = 0;
    const rng = () => {
      const v = (i % 10) / 10;
      i += 1;
      return v;
    };
    for (let n = 0; n < 30; n += 1) {
      const picked = s.pick(c, rng);
      if (picked) seen.add(picked);
    }
    expect(seen.has('mid')).toBe(false);
    expect(seen.has('top.a') || seen.has('top.b')).toBe(true);
  });

  it('uses the rng output to choose among tied candidates', () => {
    const s = new TemplateSelector();
    s.add('a', { classifications: [Classification.Blunder] });
    s.add('b', { classifications: [Classification.Blunder] });
    s.add('c', { classifications: [Classification.Blunder] });
    const c = ctx({ classification: Classification.Blunder });

    expect(s.pick(c, () => 0.0)).toBe('a');
    expect(s.pick(c, () => 0.34)).toBe('b');
    expect(s.pick(c, () => 0.99)).toBe('c');
  });

  it('throws when the rng returns an out-of-range number', () => {
    const s = new TemplateSelector();
    s.add('a');
    expect(() => s.pick(ctx(), () => 1.0)).toThrow(/in \[0, 1\)/);
    expect(() => s.pick(ctx(), () => -0.1)).toThrow(/in \[0, 1\)/);
    expect(() => s.pick(ctx(), () => NaN)).toThrow();
  });
});

describe('TemplateSelector — bookkeeping', () => {
  it('throws when adding a duplicate id', () => {
    const s = new TemplateSelector();
    s.add('x');
    expect(() => s.add('x')).toThrow(/already in the selector/i);
  });

  it('reports has/size/clear correctly', () => {
    const s = new TemplateSelector();
    expect(s.size()).toBe(0);
    s.add('a');
    s.add('b', { motifs: ['fork'] satisfies MotifTag[] });
    expect(s.size()).toBe(2);
    expect(s.has('a')).toBe(true);
    expect(s.has('missing')).toBe(false);
    s.clear();
    expect(s.size()).toBe(0);
  });
});
