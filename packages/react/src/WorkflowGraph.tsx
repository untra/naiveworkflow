/**
 * <WorkflowGraph> — a minimal, props-driven React Flow renderer for the
 * naiveworkflow IR. It flattens the nested IR, lays it out with dagre, and
 * draws a clickable dependency graph. Node-click behavior and node visuals are
 * the two configuration seams: pass `onNodeClick` and/or `renderNode`.
 *
 * <WorkflowFlow> is the lower-level component for consumers who already hold a
 * flat node/edge list (e.g. their own flatten step).
 */

import type { IRGraph, Meta } from '@naiveworkflow/compiler/ir';
import {
  Background,
  type Edge,
  Handle,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { DefaultNodeBody } from './DefaultNode.js';
import { type FlatEdge, type FlatNode, flattenIR } from './flatten.js';
import { type LayoutOptions, dagreLayout } from './layout.js';

/** Neutral default phase palette. Override via `phaseColors`. */
const DEFAULT_PALETTE = [
  '#6ea8fe',
  '#5fd0a8',
  '#f7a072',
  '#c98bdb',
  '#e8c468',
  '#7ec9e8',
  '#e87e9e',
  '#9ee87e',
];

interface CommonProps {
  /** Controlled selection. Omit to let the component manage selection itself. */
  selectedId?: string | null;
  onNodeClick?: (node: FlatNode, event: MouseEvent) => void;
  onNodeDoubleClick?: (node: FlatNode, event: MouseEvent) => void;
  /** Replace the node body entirely. Edge handles are still provided for you. */
  renderNode?: (node: FlatNode, state: { selected: boolean }) => ReactNode;
  /** Per-phase accent colors, indexed by `phaseIndex`. */
  phaseColors?: string[];
  layoutOptions?: LayoutOptions;
  fitView?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Extra React Flow children (e.g. <Controls/>, <MiniMap/>). */
  children?: ReactNode;
}

export interface WorkflowFlowProps extends CommonProps {
  nodes: FlatNode[];
  edges: FlatEdge[];
}

export interface WorkflowGraphProps extends CommonProps {
  graph: IRGraph;
  meta?: Meta | null;
}

interface NodeData extends Record<string, unknown> {
  flat: FlatNode;
  color?: string;
  renderNode?: CommonProps['renderNode'];
}

/** The single registered node type: provides handles, delegates the body. */
function NodeView(props: NodeProps) {
  const { flat, color, renderNode } = props.data as NodeData;
  const selected = props.selected ?? false;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      {renderNode ? (
        renderNode(flat, { selected })
      ) : (
        <DefaultNodeBody flat={flat} selected={selected} color={color} />
      )}
      <Handle type="source" position={Position.Right} />
    </>
  );
}

const edgeStyleFor = (kind: FlatEdge['kind']): CSSProperties | undefined =>
  kind === 'loop' ? { strokeDasharray: '4 4' } : undefined;

function WorkflowFlowInner({
  nodes,
  edges,
  selectedId,
  onNodeClick,
  onNodeDoubleClick,
  renderNode,
  phaseColors = DEFAULT_PALETTE,
  layoutOptions,
  fitView = true,
  className,
  style,
  children,
}: WorkflowFlowProps) {
  const [internalSel, setInternalSel] = useState<string | null>(null);
  const controlled = selectedId !== undefined;
  const sel = controlled ? selectedId : internalSel;

  const nodeTypes = useMemo<NodeTypes>(() => ({ nwf: NodeView }), []);
  const positions = useMemo(
    () => dagreLayout(nodes, edges, layoutOptions),
    [nodes, edges, layoutOptions],
  );
  const flatById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const rfNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => {
        const color =
          n.phaseIndex == null ? undefined : phaseColors[n.phaseIndex % phaseColors.length];
        return {
          id: n.id,
          type: 'nwf',
          position: positions[n.id] ?? { x: 0, y: 0 },
          selected: n.id === sel,
          data: { flat: n, color, renderNode } as NodeData,
        };
      }),
    [nodes, positions, sel, renderNode, phaseColors],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: e.kind === 'loop',
        style: edgeStyleFor(e.kind),
      })),
    [edges],
  );

  const handleClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      const flat = flatById.get(node.id);
      if (!flat) return;
      if (!controlled) setInternalSel(node.id);
      onNodeClick?.(flat, event as unknown as MouseEvent);
    },
    [flatById, controlled, onNodeClick],
  );

  const handleDoubleClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      const flat = flatById.get(node.id);
      if (flat) onNodeDoubleClick?.(flat, event as unknown as MouseEvent);
    },
    [flatById, onNodeDoubleClick],
  );

  return (
    <div
      className={className ? `nwf-graph ${className}` : 'nwf-graph'}
      style={{ width: '100%', height: '100%', ...style }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleClick}
        onNodeDoubleClick={handleDoubleClick}
        fitView={fitView}
        proOptions={{ hideAttribution: true }}
      >
        {children ?? <Background />}
      </ReactFlow>
    </div>
  );
}

export function WorkflowFlow(props: WorkflowFlowProps) {
  return (
    <ReactFlowProvider>
      <WorkflowFlowInner {...props} />
    </ReactFlowProvider>
  );
}

export function WorkflowGraph({ graph, meta, ...rest }: WorkflowGraphProps) {
  const { nodes, edges } = useMemo(() => flattenIR(graph, meta), [graph, meta]);
  return <WorkflowFlow nodes={nodes} edges={edges} {...rest} />;
}
