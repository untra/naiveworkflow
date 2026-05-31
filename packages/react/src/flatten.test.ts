import type { IRGraph, IRNode, Meta } from '@untra/naiveworkflow-compiler/ir';
import { describe, expect, it } from 'vitest';
import { flattenIR } from './flatten.js';

const graph = (root: IRNode): IRGraph => ({ root });
const agent = (id: string, extra: Partial<Record<string, unknown>> = {}): IRNode =>
  ({ id, kind: 'agent', prompt: id, ...extra }) as IRNode;

// Edge lookup helper keyed by source→target.
const hasEdge = (
  edges: { source: string; target: string; kind: string }[],
  source: string,
  target: string,
  kind?: string,
) => edges.some((e) => e.source === source && e.target === target && (!kind || e.kind === kind));

describe('flattenIR — leaves', () => {
  it('flattens a single agent to one node with no edges', () => {
    const { nodes, edges } = flattenIR(
      graph(agent('a', { label: 'scan', model: 'opus', hasSchema: true })),
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: 'a',
      kind: 'agent',
      label: 'scan',
      model: 'opus',
      hasSchema: true,
    });
    expect(edges).toHaveLength(0);
  });

  it('labels an agent from its prompt when no label is given', () => {
    const { nodes } = flattenIR(graph(agent('a', { label: undefined, prompt: 'do the thing' })));
    expect(nodes[0]?.label).toBe('do the thing');
  });
});

describe('flattenIR — sequence', () => {
  it('chains sequential children with seq edges', () => {
    const root: IRNode = {
      id: 'root',
      kind: 'sequence',
      children: [agent('a'), agent('b')],
    } as IRNode;
    const { nodes, edges } = flattenIR(graph(root));
    expect(nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(edges).toHaveLength(1);
    expect(hasEdge(edges, 'a', 'b', 'seq')).toBe(true);
  });
});

describe('flattenIR — parallel', () => {
  it('splits to every lane and joins to the successor', () => {
    const par: IRNode = { id: 'p', kind: 'parallel', children: [agent('x'), agent('y')] } as IRNode;
    const root: IRNode = {
      id: 'root',
      kind: 'sequence',
      children: [agent('a'), par, agent('b')],
    } as IRNode;
    const { nodes, edges } = flattenIR(graph(root));
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set(['a', 'x', 'y', 'b']));
    // split: a feeds both lanes with a parallel edge
    expect(hasEdge(edges, 'a', 'x', 'parallel')).toBe(true);
    expect(hasEdge(edges, 'a', 'y', 'parallel')).toBe(true);
    // join: both lanes feed the successor
    expect(hasEdge(edges, 'x', 'b')).toBe(true);
    expect(hasEdge(edges, 'y', 'b')).toBe(true);
  });
});

describe('flattenIR — pipeline', () => {
  it('chains stages with pipeline edges and stamps a multiplicity badge', () => {
    const pipe: IRNode = {
      id: 'pl',
      kind: 'pipeline',
      items: { kind: 'static', n: 3 },
      stages: [agent('s1'), agent('s2')],
    } as IRNode;
    const { nodes, edges } = flattenIR(graph(pipe));
    expect(hasEdge(edges, 's1', 's2', 'pipeline')).toBe(true);
    expect(nodes.find((n) => n.id === 's1')?.badge).toContain('3');
  });
});

describe('flattenIR — branch', () => {
  it('fans the predecessor to both arms and rejoins', () => {
    const br: IRNode = {
      id: 'br',
      kind: 'branch',
      conditionText: 'ok',
      consequent: agent('c'),
      alternate: agent('e'),
    } as IRNode;
    const root: IRNode = {
      id: 'root',
      kind: 'sequence',
      children: [agent('a'), br, agent('b')],
    } as IRNode;
    const { edges } = flattenIR(graph(root));
    expect(hasEdge(edges, 'a', 'c', 'branch')).toBe(true);
    expect(hasEdge(edges, 'a', 'e', 'branch')).toBe(true);
    expect(hasEdge(edges, 'c', 'b')).toBe(true);
    expect(hasEdge(edges, 'e', 'b')).toBe(true);
  });
});

describe('flattenIR — loop', () => {
  it('stamps a repeat badge and adds a loop back-edge', () => {
    const loop: IRNode = {
      id: 'lp',
      kind: 'loop',
      repeat: { kind: 'while', conditionText: 'more' },
      body: agent('l'),
    } as IRNode;
    const { nodes, edges } = flattenIR(graph(loop));
    expect(nodes.find((n) => n.id === 'l')?.badge).toContain('more');
    expect(hasEdge(edges, 'l', 'l', 'loop')).toBe(true);
  });
});

describe('flattenIR — fanout', () => {
  it('stamps a multiplicity badge from a symbolic source', () => {
    const fan: IRNode = {
      id: 'fo',
      kind: 'fanout',
      op: 'map',
      multiplicity: { kind: 'symbolic', sourceText: 'findings' },
      body: agent('f'),
    } as IRNode;
    const { nodes } = flattenIR(graph(fan));
    expect(nodes.find((n) => n.id === 'f')?.badge).toContain('findings');
  });
});

describe('flattenIR — phases', () => {
  it('tags descendants with the enclosing phase and indexes them from meta', () => {
    const root: IRNode = {
      id: 'root',
      kind: 'sequence',
      children: [
        { id: 'ps', kind: 'phase', title: 'Scan', children: [agent('a')] } as IRNode,
        { id: 'pf', kind: 'phase', title: 'Fix', children: [agent('b')] } as IRNode,
      ],
    } as IRNode;
    const meta: Meta = {
      name: null,
      description: null,
      phases: [{ title: 'Scan' }, { title: 'Fix' }],
    };
    const { nodes, edges } = flattenIR(graph(root), meta);
    const a = nodes.find((n) => n.id === 'a');
    const b = nodes.find((n) => n.id === 'b');
    expect(a).toMatchObject({ phase: 'Scan', phaseIndex: 0 });
    expect(b).toMatchObject({ phase: 'Fix', phaseIndex: 1 });
    // phase is transparent to flow: a still chains to b
    expect(hasEdge(edges, 'a', 'b', 'seq')).toBe(true);
  });
});
