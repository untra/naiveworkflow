import { describe, expect, it } from 'vitest';
import type { FlatEdge, FlatNode } from './flatten.js';
import { dagreLayout } from './layout.js';

const node = (id: string): FlatNode => ({ id, kind: 'agent', label: id });
const edge = (source: string, target: string): FlatEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  kind: 'seq',
});

describe('dagreLayout', () => {
  it('returns a position for every node', () => {
    const pos = dagreLayout([node('a'), node('b')], [edge('a', 'b')]);
    const a = pos.a;
    expect(a).toBeDefined();
    expect(pos.b).toBeDefined();
    expect(typeof a?.x).toBe('number');
    expect(typeof a?.y).toBe('number');
  });

  it('lays a chain out left-to-right (x increases along edges)', () => {
    const pos = dagreLayout([node('a'), node('b'), node('c')], [edge('a', 'b'), edge('b', 'c')]);
    const { a, b, c } = pos;
    if (!a || !b || !c) throw new Error('expected positions for a, b, c');
    expect(a.x).toBeLessThan(b.x);
    expect(b.x).toBeLessThan(c.x);
  });

  it('lays a chain out top-to-bottom (y increases along edges) with direction TB', () => {
    const pos = dagreLayout([node('a'), node('b'), node('c')], [edge('a', 'b'), edge('b', 'c')], {
      direction: 'TB',
    });
    const { a, b, c } = pos;
    if (!a || !b || !c) throw new Error('expected positions for a, b, c');
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
  });

  it('handles an empty graph', () => {
    expect(dagreLayout([], [])).toEqual({});
  });

  it('ignores edges whose endpoints are missing', () => {
    const pos = dagreLayout([node('a')], [edge('a', 'ghost')]);
    expect(pos.a).toBeDefined();
    expect(pos.ghost).toBeUndefined();
  });
});
