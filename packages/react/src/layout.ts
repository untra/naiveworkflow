/**
 * Lay a flat graph out with dagre and return top-left pixel positions keyed by
 * node id — ready to drop into React Flow `node.position`.
 *
 * The dagre setup (LR ranks, center→top-left conversion, skip-dangling-edges)
 * follows the pattern in the sibling project's `src/graph/layout.ts`
 * (claude-workflow-visualizer, MIT © Alex Ryskin); reimplemented here against
 * our `FlatNode`/`FlatEdge` types rather than copied.
 */

import dagre from 'dagre';
import type { FlatEdge, FlatNode } from './flatten.js';

export interface Position {
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Default node box width fed to dagre. */
  nodeWidth?: number;
  /** Default node box height fed to dagre. */
  nodeHeight?: number;
  /** dagre `rankdir`. */
  direction?: 'LR' | 'TB' | 'RL' | 'BT';
  /** Spacing between nodes in the same rank. */
  nodeSep?: number;
  /** Spacing between ranks. */
  rankSep?: number;
}

const DEFAULTS = {
  nodeWidth: 230,
  nodeHeight: 84,
  direction: 'LR' as const,
  nodeSep: 28,
  rankSep: 110,
};

export function dagreLayout(
  nodes: FlatNode[],
  edges: FlatEdge[],
  opts: LayoutOptions = {},
): Record<string, Position> {
  const { nodeWidth, nodeHeight, direction, nodeSep, rankSep } = { ...DEFAULTS, ...opts };
  const positions: Record<string, Position> = {};
  if (nodes.length === 0) return positions;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
  for (const e of edges) {
    // Skip self-loops (loop back-edges) and dangling edges: dagre cannot rank
    // them and they would otherwise distort the layout.
    if (e.source === e.target) continue;
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  for (const n of nodes) {
    const dn = g.node(n.id);
    positions[n.id] = dn ? { x: dn.x - nodeWidth / 2, y: dn.y - nodeHeight / 2 } : { x: 0, y: 0 };
  }
  return positions;
}
