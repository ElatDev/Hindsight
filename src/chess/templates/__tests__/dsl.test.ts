import { describe, expect, it } from 'vitest';
import { parseTemplate, renderTemplate } from '../dsl';

const render = (src: string, ctx: Record<string, unknown> = {}) =>
  renderTemplate(parseTemplate(src), ctx as never);

describe('parseTemplate / renderTemplate — plain text', () => {
  it('renders a string with no markup verbatim', () => {
    expect(render('Just plain text.')).toBe('Just plain text.');
  });

  it('handles an empty source', () => {
    expect(render('')).toBe('');
  });

  it('preserves whitespace and punctuation', () => {
    expect(render('  hello,\nworld!  ')).toBe('  hello,\nworld!  ');
  });
});

describe('parseTemplate / renderTemplate — variables', () => {
  it('substitutes a single variable', () => {
    expect(render('Hello, {name}!', { name: 'Vince' })).toBe('Hello, Vince!');
  });

  it('substitutes multiple variables in one template', () => {
    expect(
      render('{piece} captures on {square}', {
        piece: 'knight',
        square: 'd5',
      }),
    ).toBe('knight captures on d5');
  });

  it('tolerates whitespace around a variable name', () => {
    expect(render('Hello, { name }!', { name: 'Vince' })).toBe('Hello, Vince!');
  });

  it('throws when a referenced variable is missing from context', () => {
    expect(() => render('Hello, {name}!')).toThrow(/not defined in context/i);
  });

  it('uses the fallback when a variable is missing entirely', () => {
    expect(render('Hello, {name?friend}!', {})).toBe('Hello, friend!');
  });

  it('uses the fallback when a variable is null', () => {
    expect(render('Hello, {name?friend}!', { name: null })).toBe(
      'Hello, friend!',
    );
  });

  it('uses the fallback when a variable is the empty string', () => {
    expect(render('Hello, {name?friend}!', { name: '' })).toBe(
      'Hello, friend!',
    );
  });

  it('emits empty string when a variable is empty and no fallback is provided', () => {
    expect(render('Hello, {name}!', { name: '' })).toBe('Hello, !');
  });

  it('renders numeric variables', () => {
    expect(render('mate in {n}', { n: 3 })).toBe('mate in 3');
    expect(render('eval {cp}', { cp: -42 })).toBe('eval -42');
  });

  it('renders boolean variables as their literal word', () => {
    expect(render('{flag}', { flag: true })).toBe('true');
  });

  it('renders array variables as a CSV', () => {
    expect(render('{xs}', { xs: ['a', 'b', 'c'] })).toBe('a, b, c');
  });

  it('throws on non-finite numbers', () => {
    expect(() => render('{n}', { n: NaN })).toThrow(/non-finite/i);
    expect(() => render('{n}', { n: Infinity })).toThrow(/non-finite/i);
  });

  it('throws on object variables', () => {
    expect(() => render('{x}', { x: { foo: 1 } })).toThrow(
      /string\|number\|boolean\|array/,
    );
  });
});

describe('parseTemplate / renderTemplate — conditionals', () => {
  it('renders the then branch when the flag is truthy', () => {
    expect(render('A{?flag}B{/}C', { flag: true })).toBe('ABC');
  });

  it('skips the then branch when the flag is falsy', () => {
    expect(render('A{?flag}B{/}C', { flag: false })).toBe('AC');
  });

  it('treats null/undefined/0/empty-string/empty-array as falsy', () => {
    const tpl = '{?x}YES{/}';
    expect(render(tpl, { x: null })).toBe('');
    expect(render(tpl, { x: undefined })).toBe('');
    expect(render(tpl, { x: 0 })).toBe('');
    expect(render(tpl, { x: '' })).toBe('');
    expect(render(tpl, { x: [] })).toBe('');
  });

  it('treats non-empty strings, non-zero numbers, and non-empty arrays as truthy', () => {
    const tpl = '{?x}YES{/}';
    expect(render(tpl, { x: 'no' })).toBe('YES');
    expect(render(tpl, { x: 1 })).toBe('YES');
    expect(render(tpl, { x: [0] })).toBe('YES');
  });

  it('renders the else branch when present and the flag is falsy', () => {
    expect(render('{?flag}yes{:}no{/}', { flag: false })).toBe('no');
    expect(render('{?flag}yes{:}no{/}', { flag: true })).toBe('yes');
  });

  it('supports negated conditionals', () => {
    expect(render('{?!book}analyzed{/}', { book: false })).toBe('analyzed');
    expect(render('{?!book}analyzed{/}', { book: true })).toBe('');
  });

  it('supports negated conditionals with else', () => {
    expect(render('{?!book}live{:}book{/}', { book: true })).toBe('book');
    expect(render('{?!book}live{:}book{/}', { book: false })).toBe('live');
  });

  it('substitutes variables inside the conditional body', () => {
    expect(render('{?inMate}mate in {n}{/}', { inMate: true, n: 3 })).toBe(
      'mate in 3',
    );
    expect(render('{?inMate}mate in {n}{/}', { inMate: false, n: 3 })).toBe('');
  });

  it('does not require variables that only appear in an unrendered branch', () => {
    // `n` is missing — but the false branch is the only branch evaluated.
    expect(() =>
      render('{?inMate}mate in {n}{/}', { inMate: false }),
    ).not.toThrow();
  });

  it('supports nested conditionals', () => {
    const tpl = '{?a}A{?b}B{:}b{/}{:}{?c}C{/}{/}';
    expect(render(tpl, { a: true, b: true, c: false })).toBe('AB');
    expect(render(tpl, { a: true, b: false, c: false })).toBe('Ab');
    expect(render(tpl, { a: false, b: true, c: true })).toBe('C');
    expect(render(tpl, { a: false, b: true, c: false })).toBe('');
  });

  it('throws when the conditional flag is missing from context', () => {
    expect(() => render('{?flag}x{/}', {})).toThrow(/unknown variable/i);
  });
});

describe('parseTemplate / renderTemplate — escapes', () => {
  it('treats \\{ and \\} as literal braces', () => {
    expect(render('use \\{name\\} for substitution', { name: 'x' })).toBe(
      'use {name} for substitution',
    );
  });

  it('treats \\\\ as a literal backslash', () => {
    expect(render('a\\\\b')).toBe('a\\b');
  });

  it('rejects unknown escape sequences', () => {
    expect(() => render('a\\nb')).toThrow(/invalid escape/i);
  });
});

describe('parseTemplate — syntax errors', () => {
  it('rejects an unmatched opening brace at end of input', () => {
    expect(() => parseTemplate('hello {')).toThrow();
  });

  it('rejects a stray closing brace', () => {
    expect(() => parseTemplate('hello }')).toThrow(/unexpected '\}'/i);
  });

  it('rejects an unterminated conditional', () => {
    expect(() => parseTemplate('{?flag}forever')).toThrow(/unterminated/i);
  });

  it('rejects a stray {/} at top level', () => {
    expect(() => parseTemplate('hello{/}')).toThrow(/top level/i);
  });

  it('rejects a stray {:} at top level', () => {
    expect(() => parseTemplate('hello{:}there')).toThrow(/top level/i);
  });

  it('rejects an empty variable name', () => {
    expect(() => parseTemplate('{}')).toThrow(/expected a variable name/i);
  });

  it('rejects fallback containing braces', () => {
    expect(() => parseTemplate('{x?{nope}}')).toThrow(
      /fallback may not contain/i,
    );
  });
});

describe('parseTemplate — vars introspection', () => {
  it('collects variable names from the source', () => {
    const t = parseTemplate('{a} {?b}{c}{/}{?!d}{e}{:}{f}{/}');
    expect(t.vars).toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f']));
  });

  it('reports an empty set for plain-text templates', () => {
    expect(parseTemplate('hello').vars.size).toBe(0);
  });
});
