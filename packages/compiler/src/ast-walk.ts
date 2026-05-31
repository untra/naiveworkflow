import type { Node } from 'estree';

/** Depth-first: true if `node` or any descendant satisfies `pred`. */
export function someDescendant(node: Node, pred: (n: Node) => boolean): boolean {
  if (pred(node)) return true;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range') continue;
    // biome-ignore lint/suspicious/noExplicitAny: generic AST traversal
    const val = (node as any)[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item.type === 'string' && someDescendant(item, pred)) return true;
      }
    } else if (val && typeof val.type === 'string') {
      if (someDescendant(val, pred)) return true;
    }
  }
  return false;
}

export const PRIMITIVE_NAMES = new Set(['agent', 'parallel', 'pipeline', 'phase', 'log', 'workflow']);

/** Whether an expression (transitively) calls a workflow primitive by name. */
export function containsPrimitive(node: Node): boolean {
  return someDescendant(
    node,
    (n) =>
      n.type === 'CallExpression' &&
      n.callee.type === 'Identifier' &&
      PRIMITIVE_NAMES.has(n.callee.name),
  );
}
