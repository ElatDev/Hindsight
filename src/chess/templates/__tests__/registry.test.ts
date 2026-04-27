import { describe, expect, it } from 'vitest';
import { TemplateRegistry } from '../registry';

describe('TemplateRegistry — register + render', () => {
  it('registers a template and renders it against context', () => {
    const r = new TemplateRegistry();
    r.register('greet', 'Hello, {name}!');
    expect(r.render('greet', { name: 'Vince' })).toBe('Hello, Vince!');
  });

  it('throws when registering an id twice', () => {
    const r = new TemplateRegistry();
    r.register('x', 'a');
    expect(() => r.register('x', 'b')).toThrow(/already registered/i);
  });

  it('throws when rendering an unknown id', () => {
    const r = new TemplateRegistry();
    expect(() => r.render('missing', {})).toThrow(/no template registered/i);
  });

  it('returns the parsed template from register() with vars introspection', () => {
    const r = new TemplateRegistry();
    const parsed = r.register('t', '{a}{?b}{c}{/}');
    expect(parsed.vars).toEqual(new Set(['a', 'b', 'c']));
  });

  it('caches the parsed AST — get() returns the same object across calls', () => {
    const r = new TemplateRegistry();
    r.register('t', '{name}');
    const a = r.get('t');
    const b = r.get('t');
    expect(a).toBeDefined();
    expect(a).toBe(b);
  });
});

describe('TemplateRegistry — bulk operations', () => {
  it('loads multiple templates from a record object', () => {
    const r = new TemplateRegistry();
    r.loadFromRecord({
      a: 'first',
      b: 'second {x}',
    });
    expect(r.render('a', {})).toBe('first');
    expect(r.render('b', { x: 'two' })).toBe('second two');
  });

  it('rolls back when one of the bulk entries fails to parse', () => {
    const r = new TemplateRegistry();
    r.register('existing', 'kept');
    expect(() =>
      r.loadFromRecord({
        good: 'fine',
        bad: '{?flag} unterminated',
      }),
    ).toThrow();
    expect(r.has('existing')).toBe(true);
    expect(r.has('good')).toBe(false);
    expect(r.has('bad')).toBe(false);
    expect(r.size()).toBe(1);
  });

  it('rolls back when a bulk entry collides with an existing id', () => {
    const r = new TemplateRegistry();
    r.register('dup', 'one');
    expect(() => r.loadFromRecord({ fresh: 'ok', dup: 'two' })).toThrow(
      /already registered/i,
    );
    expect(r.has('fresh')).toBe(false);
    expect(r.render('dup', {})).toBe('one');
  });
});

describe('TemplateRegistry — introspection', () => {
  it('reports has/size/ids correctly', () => {
    const r = new TemplateRegistry();
    expect(r.size()).toBe(0);
    expect(r.has('x')).toBe(false);
    r.register('zeta', 'z');
    r.register('alpha', 'a');
    expect(r.size()).toBe(2);
    expect(r.has('alpha')).toBe(true);
    expect(r.ids()).toEqual(['alpha', 'zeta']);
  });

  it('clear() empties the registry', () => {
    const r = new TemplateRegistry();
    r.register('a', '1');
    r.register('b', '2');
    r.clear();
    expect(r.size()).toBe(0);
    expect(r.has('a')).toBe(false);
  });
});
