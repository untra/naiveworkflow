import { describe, expect, it } from 'vitest';
import { irJsonSchema } from './json-schema.js';
import { irGraphSchema, irNodeSchema, metaSchema } from './schema.js';

describe('metaSchema', () => {
  it('accepts a well-formed meta', () => {
    const m = {
      name: 'x',
      description: null,
      phases: [{ title: 'A', detail: 'd' }, { title: 'B' }],
    };
    expect(metaSchema.parse(m)).toEqual(m);
  });

  it('rejects a phase without a title', () => {
    expect(() =>
      metaSchema.parse({ name: 'x', description: null, phases: [{ detail: 'd' }] }),
    ).toThrow();
  });
});

describe('irNodeSchema', () => {
  it('validates a nested parallel graph of agents', () => {
    const node = {
      id: 'root',
      kind: 'parallel',
      children: [
        { id: 'root/0', kind: 'agent', prompt: 'a' },
        { id: 'root/1', kind: 'agent', prompt: 'b', label: 'beta', hasSchema: true },
      ],
    };
    expect(irNodeSchema.parse(node)).toEqual(node);
  });

  it('rejects an unknown node kind', () => {
    expect(() => irNodeSchema.parse({ id: 'x', kind: 'nope' })).toThrow();
  });

  it('rejects an agent missing its prompt field', () => {
    expect(() => irNodeSchema.parse({ id: 'x', kind: 'agent' })).toThrow();
  });

  it('round-trips a fanout with symbolic multiplicity', () => {
    const node = {
      id: 'r',
      kind: 'fanout',
      op: 'map',
      multiplicity: { kind: 'symbolic', sourceText: 'findings' },
      body: { id: 'r/b', kind: 'agent', prompt: 'x' },
    };
    expect(irNodeSchema.parse(node)).toEqual(node);
  });

  it('round-trips a loop with a while repeat', () => {
    const node = {
      id: 'r',
      kind: 'loop',
      repeat: { kind: 'while', conditionText: 'budget.remaining() > 50000' },
      body: { id: 'r/b', kind: 'sequence', children: [] },
    };
    expect(irNodeSchema.parse(node)).toEqual(node);
  });
});

describe('irGraphSchema', () => {
  it('wraps a root node', () => {
    const g = { root: { id: 'root', kind: 'sequence', children: [] } };
    expect(irGraphSchema.parse(g)).toEqual(g);
  });
});

describe('irJsonSchema', () => {
  it('exports a JSON Schema object', () => {
    const js = irJsonSchema() as Record<string, unknown>;
    expect(js).toHaveProperty('$schema');
  });
});
