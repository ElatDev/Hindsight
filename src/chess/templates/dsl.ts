/**
 * Tiny templating DSL for the Hindsight explanation engine.
 *
 * Goals:
 *  - Author 100+ explanation snippets without writing TS for each.
 *  - Substitute named variables and gate text on boolean flags.
 *  - Catch typos at parse time (unknown braces, malformed conditionals)
 *    and at render time (referenced var missing from the context).
 *
 * Syntax summary (full grammar in unit tests):
 *   {name}            required variable; throws if absent from context.
 *   {name?fallback}   variable with literal fallback when missing/empty.
 *   {?flag}…{/}        conditional block; rendered when `flag` is truthy.
 *   {?flag}…{:}…{/}    conditional with else branch.
 *   {?!flag}…{/}       negated conditional; rendered when `flag` is falsy.
 *   \{ \} \\           escape literal braces / backslashes.
 *
 * Whitespace inside the braces around a name is tolerated (`{ name }` is
 * equivalent to `{name}`). Variable names follow the JS identifier rule:
 * `[A-Za-z_][A-Za-z0-9_]*`.
 *
 * Truthiness rules for conditionals (chosen so chess-y data lands the right
 * way): `null`, `undefined`, `false`, `0`, `''`, and empty arrays are
 * falsy. Everything else is truthy. We do *not* coerce strings like `"0"` —
 * pass a real boolean if you mean a flag.
 */

/** A single piece of the parsed template. */
export type TemplateNode =
  | { type: 'text'; value: string }
  | { type: 'var'; name: string; fallback: string | null }
  | {
      type: 'cond';
      name: string;
      negate: boolean;
      then: TemplateNode[];
      otherwise: TemplateNode[];
    };

export type ParsedTemplate = {
  /** Raw source the template was parsed from. Useful for debugging. */
  readonly source: string;
  readonly nodes: readonly TemplateNode[];
  /** Every variable name referenced anywhere (vars + conditionals). */
  readonly vars: ReadonlySet<string>;
};

/** Allowed value types for template substitution. Objects/functions throw. */
export type TemplateValue =
  | string
  | number
  | boolean
  | readonly unknown[]
  | null
  | undefined;

export type RenderContext = Readonly<Record<string, TemplateValue>>;

/** Parse a template source string into a renderable AST. Throws on syntax errors. */
export function parseTemplate(source: string): ParsedTemplate {
  const cur: Cursor = { src: source, i: 0 };
  const result = parseNodes(cur);
  if (result.term !== 'eof') {
    throw new SyntaxError(
      result.term === 'else'
        ? `Unexpected '{:}' at top level (index ${cur.i - 3})`
        : `Unexpected '{/}' at top level (index ${cur.i - 3})`,
    );
  }
  return {
    source,
    nodes: result.nodes,
    vars: collectVars(result.nodes, new Set<string>()),
  };
}

/** Render a parsed template against a context object. Throws on missing vars. */
export function renderTemplate(
  parsed: ParsedTemplate,
  ctx: RenderContext,
): string {
  return renderNodes(parsed.nodes, ctx);
}

// ---------------------------------------------------------------------------
// Parser internals
// ---------------------------------------------------------------------------

type Cursor = { src: string; i: number };
type Terminator = 'eof' | 'end' | 'else';

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*/;

function parseNodes(cur: Cursor): { nodes: TemplateNode[]; term: Terminator } {
  const out: TemplateNode[] = [];
  let textBuf = '';
  const flush = () => {
    if (textBuf.length > 0) {
      out.push({ type: 'text', value: textBuf });
      textBuf = '';
    }
  };

  while (cur.i < cur.src.length) {
    const ch = cur.src[cur.i];

    // Backslash escapes a literal `{`, `}`, or `\`.
    if (ch === '\\') {
      const next = cur.src[cur.i + 1];
      if (next === '{' || next === '}' || next === '\\') {
        textBuf += next;
        cur.i += 2;
        continue;
      }
      throw new SyntaxError(
        `Invalid escape sequence '\\${next ?? ''}' at index ${cur.i}`,
      );
    }

    if (ch === '}') {
      throw new SyntaxError(`Unexpected '}' at index ${cur.i}`);
    }

    if (ch !== '{') {
      textBuf += ch;
      cur.i += 1;
      continue;
    }

    // ch === '{' — figure out which token this is.
    const next = cur.src[cur.i + 1];

    if (next === '/' && cur.src[cur.i + 2] === '}') {
      flush();
      cur.i += 3;
      return { nodes: out, term: 'end' };
    }
    if (next === ':' && cur.src[cur.i + 2] === '}') {
      flush();
      cur.i += 3;
      return { nodes: out, term: 'else' };
    }

    if (next === '?') {
      flush();
      cur.i += 2; // past '{?'
      let negate = false;
      if (cur.src[cur.i] === '!') {
        negate = true;
        cur.i += 1;
      }
      const name = readName(cur);
      consumeChar(cur, '}', `after conditional name '${name}'`);
      const branchA = parseNodes(cur);
      let otherwise: TemplateNode[] = [];
      if (branchA.term === 'else') {
        const branchB = parseNodes(cur);
        if (branchB.term !== 'end') {
          throw new SyntaxError(
            `Unterminated conditional '?${negate ? '!' : ''}${name}' (missing '{/}' after else)`,
          );
        }
        otherwise = branchB.nodes;
      } else if (branchA.term !== 'end') {
        throw new SyntaxError(
          `Unterminated conditional '?${negate ? '!' : ''}${name}' (missing '{/}')`,
        );
      }
      out.push({
        type: 'cond',
        name,
        negate,
        then: branchA.nodes,
        otherwise,
      });
      continue;
    }

    // Plain variable: {name} or {name?fallback}
    flush();
    cur.i += 1; // past '{'
    const name = readName(cur);
    let fallback: string | null = null;
    if (cur.src[cur.i] === '?') {
      cur.i += 1;
      let fb = '';
      while (cur.i < cur.src.length) {
        const c = cur.src[cur.i];
        if (c === '}') break;
        if (c === '{' || c === '\\') {
          throw new SyntaxError(
            `Variable fallback may not contain '${c}' (index ${cur.i}). Use a conditional for complex fallbacks.`,
          );
        }
        fb += c;
        cur.i += 1;
      }
      fallback = fb;
    }
    consumeChar(cur, '}', `after variable '${name}'`);
    out.push({ type: 'var', name, fallback });
  }

  flush();
  return { nodes: out, term: 'eof' };
}

function readName(cur: Cursor): string {
  while (cur.i < cur.src.length && cur.src[cur.i] === ' ') cur.i += 1;
  const m = NAME_RE.exec(cur.src.slice(cur.i));
  if (!m) {
    throw new SyntaxError(`Expected a variable name at index ${cur.i}`);
  }
  cur.i += m[0].length;
  while (cur.i < cur.src.length && cur.src[cur.i] === ' ') cur.i += 1;
  return m[0];
}

function consumeChar(cur: Cursor, ch: string, context: string): void {
  if (cur.src[cur.i] !== ch) {
    throw new SyntaxError(
      `Expected '${ch}' ${context} at index ${cur.i} (got ${describeChar(cur.src[cur.i])})`,
    );
  }
  cur.i += 1;
}

function describeChar(ch: string | undefined): string {
  if (ch === undefined) return 'end of input';
  return `'${ch}'`;
}

function collectVars(
  nodes: readonly TemplateNode[],
  out: Set<string>,
): Set<string> {
  for (const n of nodes) {
    if (n.type === 'var' || n.type === 'cond') out.add(n.name);
    if (n.type === 'cond') {
      collectVars(n.then, out);
      collectVars(n.otherwise, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Renderer internals
// ---------------------------------------------------------------------------

function renderNodes(
  nodes: readonly TemplateNode[],
  ctx: RenderContext,
): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      out += n.value;
      continue;
    }
    if (n.type === 'var') {
      out += renderVar(n.name, n.fallback, ctx);
      continue;
    }
    const present = Object.prototype.hasOwnProperty.call(ctx, n.name);
    if (!present) {
      throw new ReferenceError(
        `Template conditional references unknown variable '${n.name}'`,
      );
    }
    const truthy = isTruthy(ctx[n.name]);
    const branch = truthy !== n.negate ? n.then : n.otherwise;
    out += renderNodes(branch, ctx);
  }
  return out;
}

function renderVar(
  name: string,
  fallback: string | null,
  ctx: RenderContext,
): string {
  const present = Object.prototype.hasOwnProperty.call(ctx, name);
  if (!present) {
    if (fallback != null) return fallback;
    throw new ReferenceError(
      `Template variable '${name}' is not defined in context`,
    );
  }
  const v = ctx[name];
  if (v == null || v === '') {
    return fallback ?? '';
  }
  return stringifyValue(name, v);
}

function stringifyValue(name: string, v: TemplateValue): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      throw new TypeError(
        `Template variable '${name}' is a non-finite number (${v})`,
      );
    }
    return String(v);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  // Arrays render as comma-separated values — handy for short lists like
  // fork targets ("queen and rook" is the caller's job; arrays default to
  // a CSV which still beats `[object Object]`).
  if (Array.isArray(v)) return v.join(', ');
  throw new TypeError(
    `Template variable '${name}' must be string|number|boolean|array, got ${typeof v}`,
  );
}

function isTruthy(v: TemplateValue): boolean {
  if (v == null) return false;
  if (v === false || v === 0 || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}
