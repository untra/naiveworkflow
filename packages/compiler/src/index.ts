/**
 * @naiveworkflow/compiler
 *
 * Statically compiles a Claude workflow JS file into a coordinate-free IR.
 * The target source is parsed with acorn and inspected as an AST — it is
 * NEVER executed (no eval/Function/vm/dynamic import).
 */

export * from './ir/index.js';
export { parseModule, type ParsedModule } from './parse.js';
export { extractMeta } from './meta.js';
export { evalStatic } from './eval.js';
