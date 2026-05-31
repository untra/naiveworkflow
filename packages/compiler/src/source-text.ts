import type { Expression, Node, SpreadElement } from 'estree';
import { evalStatic } from './eval.js';

/** The exact source text a node spans (requires `ranges` at parse time). */
export function sliceNode(node: Node, source: string): string {
  const range = node.range;
  return range ? source.slice(range[0], range[1]) : '';
}

/** A condition's source text, trimmed and collapsed to one line for labels. */
export function conditionText(node: Node, source: string): string {
  return sliceNode(node, source).replace(/\s+/g, ' ').trim();
}

/** The first argument's string value (literal or no-substitution template), or null. */
export function firstStringArg(args: Array<Expression | SpreadElement>): string | null {
  const first = args[0];
  if (!first || first.type === 'SpreadElement') return null;
  const r = evalStatic(first);
  return r.ok && typeof r.value === 'string' ? r.value : null;
}
