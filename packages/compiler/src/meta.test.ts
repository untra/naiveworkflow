import { describe, expect, it } from 'vitest';
import { extractMeta } from './meta.js';
import { parseModule } from './parse.js';

const meta = (src: string) => {
  const { program } = parseModule(src);
  return extractMeta(program, src);
};

describe('extractMeta', () => {
  it('reads name, description and phases from a literal meta export', () => {
    const m = meta(`
      export const meta = {
        name: 'find-flaky-tests',
        description: 'Find flaky tests and propose fixes',
        phases: [
          { title: 'Scan', detail: 'grep logs' },
          { title: 'Fix' },
        ],
      };
      phase('Scan');
    `);
    expect(m).toEqual({
      name: 'find-flaky-tests',
      description: 'Find flaky tests and propose fixes',
      phases: [{ title: 'Scan', detail: 'grep logs' }, { title: 'Fix' }],
    });
  });

  it('returns null when there is no meta export', () => {
    expect(meta("const x = 1; agent('hi');")).toBeNull();
  });

  it('reads a no-substitution template literal as a string', () => {
    const m = meta('export const meta = { name: `hello`, phases: [] };');
    expect(m?.name).toBe('hello');
  });

  it('drops a non-literal field to null instead of evaluating it', () => {
    const m = meta(`
      export const meta = { name: computeName(), description: 'ok', phases: [] };
    `);
    expect(m).toEqual({ name: null, description: 'ok', phases: [] });
  });

  it('treats a missing phases field as an empty array', () => {
    const m = meta("export const meta = { name: 'x' };");
    expect(m).toEqual({ name: 'x', description: null, phases: [] });
  });

  it('skips phase entries that are not static objects', () => {
    const m = meta(`
      export const meta = { name: 'x', phases: [{ title: 'A' }, makePhase()] };
    `);
    expect(m?.phases).toEqual([{ title: 'A' }]);
  });
});
