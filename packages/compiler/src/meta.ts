import type { Expression, ObjectExpression, Program } from 'estree';
import { evalStatic, indexProps, stringProp } from './eval.js';
import type { Meta, Phase } from './ir/types.js';

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
    name: stringProp(props, 'name'),
    description: stringProp(props, 'description'),
    phases: extractPhases(props.get('phases')),
  };
}
