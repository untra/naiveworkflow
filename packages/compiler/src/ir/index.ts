/**
 * IR barrel — schema + types only, no acorn/parser code.
 * Consumers that just need to validate or type-check IR (e.g. the renderer)
 * import from `@naiveworkflow/compiler/ir` to avoid pulling in the parser.
 */

/** Bumped when the IR shape changes incompatibly. */
export const IR_SCHEMA_VERSION = 1 as const;
