import {
  parseTemplate,
  renderTemplate,
  type ParsedTemplate,
  type RenderContext,
} from './dsl';

/**
 * In-memory registry that parses each template once and serves the cached
 * AST on every render. Phase 10 / Task 5 will populate this with the actual
 * 100+ explanation snippets; until then it's exercised by tests and by the
 * selection layer (Task 3).
 *
 * Templates are keyed by an opaque `id` chosen by the caller — typically a
 * dotted path like `"blunder.hangs.queen"` so the selection layer can match
 * on prefix.
 */
export class TemplateRegistry {
  private readonly byId = new Map<string, ParsedTemplate>();

  /**
   * Parse and register a template under `id`. Throws if `id` is already
   * taken — overwriting silently has bitten enough projects to avoid here.
   * Returns the parsed template so callers can introspect `vars` if needed.
   */
  register(id: string, source: string): ParsedTemplate {
    if (this.byId.has(id)) {
      throw new Error(`Template id '${id}' is already registered`);
    }
    const parsed = parseTemplate(source);
    this.byId.set(id, parsed);
    return parsed;
  }

  /**
   * Bulk-register templates from a `{ id: source }` object. Convenient when
   * loading from a JSON file. If any entry fails to parse, the registry is
   * left untouched (all-or-nothing).
   */
  loadFromRecord(record: Readonly<Record<string, string>>): void {
    const parsed: Array<[string, ParsedTemplate]> = [];
    for (const [id, source] of Object.entries(record)) {
      if (this.byId.has(id)) {
        throw new Error(`Template id '${id}' is already registered`);
      }
      parsed.push([id, parseTemplate(source)]);
    }
    for (const [id, p] of parsed) this.byId.set(id, p);
  }

  /** Look up a template without rendering. Useful for diagnostics. */
  get(id: string): ParsedTemplate | undefined {
    return this.byId.get(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Render a registered template. Throws if `id` is unknown. */
  render(id: string, ctx: RenderContext): string {
    const parsed = this.byId.get(id);
    if (!parsed) {
      throw new Error(`No template registered with id '${id}'`);
    }
    return renderTemplate(parsed, ctx);
  }

  size(): number {
    return this.byId.size;
  }

  /** Snapshot of all registered ids (alphabetical, for deterministic output). */
  ids(): readonly string[] {
    return Array.from(this.byId.keys()).sort();
  }

  clear(): void {
    this.byId.clear();
  }
}
