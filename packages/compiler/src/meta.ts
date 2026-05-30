import type {
  Expression,
  ObjectExpression,
  Pattern,
  Program,
  Property,
  SpreadElement,
} from 'estree';
import type { Meta, Phase } from './ir/types.js';

/**
 * Restricted AST → value evaluator. Resolves ONLY literal/array/object/
 * expression-free-template nodes to a plain JS value. Anything that would
 * require running code (identifiers, calls, spreads, member access) fails.
 * This is how `meta` is read without ever executing the source.
 */
type StaticResult = { ok: true; value: unknown } | { ok: false };
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

function propKey(prop: Property): string | null {
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

/** Find the `ObjectExpression` of a top-level `export const meta = {...}`. */
function findMetaObject(program: Program): ObjectExpression | null {
  for (const stmt of program.body) {
    if (stmt.type !== 'ExportNamedDeclaration') continue;
    const decl = stmt.declaration;
    if (!decl || decl.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) {
      if (
        d.id.type === 'Identifier' &&
        d.id.name === 'meta' &&
        d.init?.type === 'ObjectExpression'
      ) {
        return d.init;
      }
    }
  }
  return null;
}

/** Index an object's statically-keyed properties by name. */
function indexProps(node: ObjectExpression): Map<string, Expression> {
  const map = new Map<string, Expression>();
  for (const prop of node.properties) {
    if (prop.type !== 'Property' || prop.kind !== 'init') continue;
    const key = propKey(prop);
    if (key !== null) map.set(key, prop.value as Expression);
  }
  return map;
}

function stringOrNull(node: Expression | undefined): string | null {
  if (!node) return null;
  const r = evalStatic(node);
  return r.ok && typeof r.value === 'string' ? r.value : null;
}

function extractPhases(node: Expression | undefined): Phase[] {
  if (!node || node.type !== 'ArrayExpression') return [];
  const phases: Phase[] = [];
  for (const el of node.elements) {
    if (el === null || el.type === 'SpreadElement') continue;
    const r = evalStatic(el);
    if (!r.ok || typeof r.value !== 'object' || r.value === null) continue;
    const entry = r.value as Record<string, unknown>;
    if (typeof entry.title !== 'string') continue;
    phases.push(
      typeof entry.detail === 'string'
        ? { title: entry.title, detail: entry.detail }
        : { title: entry.title },
    );
  }
  return phases;
}

/**
 * Extract `meta` from the program. Returns null when there is no `export const
 * meta`. Fields that aren't statically resolvable become null (name/description)
 * or are skipped (phase entries) — they are never evaluated.
 */
export function extractMeta(program: Program, _source: string): Meta | null {
  const obj = findMetaObject(program);
  if (!obj) return null;
  const props = indexProps(obj);
  return {
    name: stringOrNull(props.get('name')),
    description: stringOrNull(props.get('description')),
    phases: extractPhases(props.get('phases')),
  };
}
