/**
 * Flatten the nested naiveworkflow IR into a plain node + edge list — the shape
 * a flat dependency-graph renderer (dagre + React Flow) consumes.
 *
 * Containers (`sequence`, `parallel`, `pipeline`, `fanout`, `loop`, `branch`,
 * `phase`) are not drawn as boxes; they only shape the edges between the leaf
 * nodes they wrap. Each walk returns the subgraph's `{ entries, exits }`
 * frontier so the caller can chain a predecessor's exits to a successor's
 * entries.
 *
 * Field names echo the sibling project's `WfNode`/`WfEdge` (claude-workflow-
 * visualizer, MIT © Alex Ryskin) so the two graph models stay interchangeable.
 */

import type { IRGraph, IRNode, Meta, Multiplicity } from '@untra/naiveworkflow-compiler/ir';

export type FlatNodeKind = 'agent' | 'workflow' | 'terminal' | 'note' | 'code';

export interface FlatNode {
  id: string;
  kind: FlatNodeKind;
  label: string;
  phase?: string;
  phaseIndex?: number;
  prompt?: string;
  model?: string;
  agentType?: string;
  isolation?: string;
  hasSchema?: boolean;
  /** A `×N`/`↻ …` annotation contributed by an enclosing fanout/pipeline/loop. */
  badge?: string;
  source?: string;
}

export type FlatEdgeKind = 'seq' | 'parallel' | 'pipeline' | 'branch' | 'loop';

export interface FlatEdge {
  id: string;
  source: string;
  target: string;
  kind: FlatEdgeKind;
}

export interface FlatGraph {
  nodes: FlatNode[];
  edges: FlatEdge[];
}

/** The first/last leaf ids of a walked subgraph, for sequential chaining. */
interface Frontier {
  entries: string[];
  exits: string[];
}

const multiplicityText = (m: Multiplicity): string =>
  m.kind === 'static' ? `×${m.n}` : `×${m.sourceText}`;

const LEAF_KINDS: Record<string, FlatNodeKind> = {
  agent: 'agent',
  workflow: 'workflow',
  terminal: 'terminal',
  note: 'note',
  code: 'code',
};

const truncate = (s: string, max = 80): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function leafLabel(node: IRNode): string {
  switch (node.kind) {
    case 'agent':
      return node.label ?? node.prompt ?? '(agent)';
    case 'workflow':
      return node.name ?? '(workflow)';
    case 'terminal':
      return node.reason;
    case 'note':
      return node.text ?? '(note)';
    case 'code':
      return node.note ?? node.source ?? '(code)';
    default:
      return node.kind;
  }
}

/**
 * Build a flat graph from IR. `meta` is optional; when given, its `phases`
 * order drives `phaseIndex`. Otherwise phases are indexed by first appearance.
 */
export function flattenIR(graph: IRGraph, meta?: Meta | null): FlatGraph {
  const nodes: FlatNode[] = [];
  const edges: FlatEdge[] = [];

  // Phase → index: seed from meta.phases, then extend by first appearance.
  const phaseIndex = new Map<string, number>();
  for (const [i, p] of (meta?.phases ?? []).entries()) phaseIndex.set(p.title, i);
  const phaseIndexOf = (title: string): number => {
    const existing = phaseIndex.get(title);
    if (existing !== undefined) return existing;
    const next = phaseIndex.size;
    phaseIndex.set(title, next);
    return next;
  };

  const addEdge = (source: string, target: string, kind: FlatEdgeKind): void => {
    edges.push({ id: `e_${source}__${target}_${edges.length}`, source, target, kind });
  };

  const emitLeaf = (
    node: IRNode,
    kind: FlatNodeKind,
    phase: string | undefined,
    badge?: string,
  ): Frontier => {
    const tag = phase ?? node.phase;
    const flat: FlatNode = { id: node.id, kind, label: truncate(leafLabel(node)) };
    if (tag) {
      flat.phase = tag;
      flat.phaseIndex = phaseIndexOf(tag);
    }
    if (badge) flat.badge = badge;
    if (node.source) flat.source = node.source;
    if (node.kind === 'agent') {
      if (node.prompt != null) flat.prompt = node.prompt;
      if (node.model) flat.model = node.model;
      if (node.agentType) flat.agentType = node.agentType;
      if (node.isolation) flat.isolation = node.isolation;
      if (node.hasSchema) flat.hasSchema = true;
    }
    nodes.push(flat);
    return { entries: [node.id], exits: [node.id] };
  };

  // Chain an ordered list of children, predecessor.exits → child.entries.
  // `linkKind` forces every inter-child edge kind (used by pipeline); when
  // omitted the kind is derived per child from `edgeKindInto`.
  const chain = (
    children: IRNode[],
    phase: string | undefined,
    badge: string | undefined,
    linkKind?: FlatEdgeKind,
  ): Frontier => {
    let prevExits: string[] = [];
    let firstEntries: string[] | null = null;
    for (const child of children) {
      const f = walk(child, phase, badge);
      if (f.entries.length === 0) continue; // skip nodes that emit nothing
      if (firstEntries === null) firstEntries = f.entries;
      const kind = linkKind ?? edgeKindInto(child);
      for (const src of prevExits) {
        for (const dst of f.entries) addEdge(src, dst, kind);
      }
      prevExits = f.exits;
    }
    return { entries: firstEntries ?? [], exits: prevExits };
  };

  // The edge kind used when flowing INTO a node from its sequential predecessor.
  const edgeKindInto = (node: IRNode): FlatEdgeKind => {
    switch (node.kind) {
      case 'parallel':
        return 'parallel';
      case 'pipeline':
        return 'pipeline';
      case 'branch':
        return 'branch';
      default:
        return 'seq';
    }
  };

  function walk(node: IRNode, phase: string | undefined, badge?: string): Frontier {
    const leaf = LEAF_KINDS[node.kind];
    if (leaf) return emitLeaf(node, leaf, phase, badge);

    switch (node.kind) {
      case 'sequence':
        return chain(node.children, phase, badge);

      case 'phase': {
        // Transparent to flow: tag descendants, chain children like a sequence.
        return chain(node.children, node.title, badge);
      }

      case 'parallel': {
        const entries: string[] = [];
        const exits: string[] = [];
        for (const child of node.children) {
          const f = walk(child, phase, badge);
          entries.push(...f.entries);
          exits.push(...f.exits);
        }
        return { entries, exits };
      }

      case 'pipeline': {
        const b = `${multiplicityText(node.items)}${badge ? ` ${badge}` : ''}`;
        return chain(node.stages, phase, b, 'pipeline');
      }

      case 'fanout': {
        const b = `${multiplicityText(node.multiplicity)}${badge ? ` ${badge}` : ''}`;
        return walk(node.body, phase, b);
      }

      case 'loop': {
        const b = `↻ ${node.repeat.kind} ${node.repeat.conditionText}`.trim();
        const f = walk(node.body, phase, badge ? `${badge} ${b}` : b);
        // Back-edge: each exit loops back to each entry.
        for (const src of f.exits) {
          for (const dst of f.entries) addEdge(src, dst, 'loop');
        }
        return f;
      }

      case 'branch': {
        const entries: string[] = [];
        const exits: string[] = [];
        const arms = [node.consequent, node.alternate].filter(Boolean) as IRNode[];
        for (const arm of arms) {
          const f = walk(arm, phase, badge);
          entries.push(...f.entries);
          exits.push(...f.exits);
        }
        return { entries, exits };
      }

      default:
        // Unknown container: render as a code-ish leaf so nothing is lost.
        return emitLeaf(node, 'code', phase, badge);
    }
  }

  walk(graph.root, undefined);
  return { nodes, edges };
}
