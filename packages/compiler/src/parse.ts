import { parse } from 'acorn';
import type { Program } from 'estree';

export interface ParsedModule {
  /** ESTree-compatible AST. Node positions live in `node.range` (ranges enabled). */
  program: Program;
  /** The original source, kept for slicing labels/snippets out of node ranges. */
  source: string;
}

/**
 * Parse a workflow module to an AST. The source is parsed only — it is never
 * executed. `ranges` is enabled so the visitor can slice human-readable labels
 * straight out of `source` using each node's `range`.
 */
export function parseModule(source: string): ParsedModule {
  const program = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    // Workflow scripts run inside an async wrapper, so a top-level `return`
    // (e.g. `return { confirmed }`) is idiomatic — allow it outside a function.
    allowReturnOutsideFunction: true,
    ranges: true,
    locations: true,
  }) as unknown as Program;
  return { program, source };
}
