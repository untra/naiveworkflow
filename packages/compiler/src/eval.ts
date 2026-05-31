import type { Expression, ObjectExpression, Pattern, Property, SpreadElement } from 'estree';

/**
 * Restricted AST → value evaluator. Resolves ONLY literal/array/object/
 * expression-free-template nodes to a plain JS value. Anything that would
 * require running code (identifiers, calls, spreads, member access) fails.
 * This is how `meta` and agent options are read without executing the source.
 */
export type StaticResult = { ok: true; value: unknown } | { ok: false };
const fail: StaticResult = { ok: false };

export function evalStatic(node: Expression | Pattern | SpreadElement | null): StaticResult {
  if (!node) return fail;
  switch (node.type) {
    case 'Literal':
      return { ok: true, value: node.value };
    case 'TemplateLiteral':
      if (node.expressions.length === 0 && node.quasis.length === 1) {
        return { ok: true, value: node.quasis[0]?.value.cooked ?? '' };
      }
      return fail;
    case 'ArrayExpression': {
      const out: unknown[] = [];
      for (const el of node.elements) {
        if (el === null || el.type === 'SpreadElement') return fail;
        const r = evalStatic(el);
        if (!r.ok) return fail;
        out.push(r.value);
      }
      return { ok: true, value: out };
    }
    case 'ObjectExpression':
      return evalObject(node);
    default:
      return fail;
  }
}

export function propKey(prop: Property): string | null {
  if (prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
  return null;
}

function evalObject(node: ObjectExpression): StaticResult {
  const obj: Record<string, unknown> = {};
  for (const prop of node.properties) {
    if (prop.type === 'SpreadElement') return fail;
    if (prop.kind !== 'init') return fail;
    const key = propKey(prop);
    if (key === null) return fail;
    const r = evalStatic(prop.value as Expression);
    if (!r.ok) return fail;
    obj[key] = r.value;
  }
  return { ok: true, value: obj };
}

/** Index an object literal's statically-keyed `init` properties by name. */
export function indexProps(node: ObjectExpression): Map<string, Expression> {
  const map = new Map<string, Expression>();
  for (const prop of node.properties) {
    if (prop.type !== 'Property' || prop.kind !== 'init') continue;
    const key = propKey(prop);
    if (key !== null) map.set(key, prop.value as Expression);
  }
  return map;
}

/** Read a string-valued option from an object literal, or null. */
export function stringProp(props: Map<string, Expression>, key: string): string | null {
  const node = props.get(key);
  if (!node) return null;
  const r = evalStatic(node);
  return r.ok && typeof r.value === 'string' ? r.value : null;
}
