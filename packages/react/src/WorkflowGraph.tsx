/**
 * <WorkflowGraph> — a slim, props-driven React Flow renderer for the
 * naiveworkflow IR. It flattens the nested IR, lays it out with dagre, and
 * draws a clickable dependency graph. The configuration seams: `renderNode`
 * (node visuals), `onNodeClick` (behavior), `theme` ('light' | 'dark'),
 * `phaseColors`, `edgeStyle`, and `nodeState` (consumer-driven highlighting).
 *
 * <WorkflowFlow> is the lower-level component for consumers who already hold a
 * flat node/edge list (e.g. their own flatten step, or an adapter from another
 * graph model).
 */

import type { IRGraph, Meta } from '@untra/naiveworkflow-compiler/ir';
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
import { DefaultNodeBody, type NodeState } from './DefaultNode.js';
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

export type Theme = 'light' | 'dark';

interface CommonProps {
  /** Controlled selection. Omit to let the component manage selection itself. */
  selectedId?: string | null;
  onNodeClick?: (node: FlatNode, event: MouseEvent) => void;
  onNodeDoubleClick?: (node: FlatNode, event: MouseEvent) => void;
  /** Replace the node body entirely. Edge handles are still provided for you. */
  renderNode?: (node: FlatNode, state: { selected: boolean }) => ReactNode;
  /** Bundled visual preset applied to the graph wrapper. Defaults to 'dark'. */
  theme?: Theme;
  /** Per-phase accent colors, indexed by `phaseIndex`. */
  phaseColors?: string[];
  /** Per-edge style override. Merged over the built-in defaults (loop = dashed). */
  edgeStyle?: (edge: FlatEdge) => CSSProperties | undefined;
  /** Optional per-node highlight state, keyed by node id. No built-in simulation. */
  nodeState?: Record<string, NodeState>;
  layoutOptions?: LayoutOptions;
  /** Lay the graph out top-to-bottom instead of the default left-to-right. */
  verticalRender?: boolean;
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
  state?: NodeState;
  renderNode?: CommonProps['renderNode'];
  vertical?: boolean;
}

/** The single registered node type: provides handles, delegates the body. */
function NodeView(props: NodeProps) {
  const { flat, color, state, renderNode, vertical } = props.data as NodeData;
  const selected = props.selected ?? false;
  return (
    <>
      <Handle type="target" position={vertical ? Position.Top : Position.Left} />
      {renderNode ? (
        renderNode(flat, { selected })
      ) : (
        <DefaultNodeBody flat={flat} selected={selected} color={color} state={state} />
      )}
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} />
    </>
  );
}

const defaultEdgeStyle = (kind: FlatEdge['kind']): CSSProperties | undefined =>
  kind === 'loop' ? { strokeDasharray: '4 4' } : undefined;

function WorkflowFlowInner({
  nodes,
  edges,
  selectedId,
  onNodeClick,
  onNodeDoubleClick,
  renderNode,
  theme = 'dark',
  phaseColors = DEFAULT_PALETTE,
  edgeStyle,
  nodeState,
  layoutOptions,
  verticalRender,
  fitView = true,
  className,
  style,
  children,
}: WorkflowFlowProps) {
  const [internalSel, setInternalSel] = useState<string | null>(null);
  const controlled = selectedId !== undefined;
  const sel = controlled ? selectedId : internalSel;

  // An explicit `layoutOptions.direction` wins over the `verticalRender`
  // convenience boolean. Derive a single direction so the dagre ranks and the
  // node handles can never disagree.
  const direction = layoutOptions?.direction ?? (verticalRender ? 'TB' : 'LR');
  const vertical = direction === 'TB' || direction === 'BT';
  const effectiveLayout = useMemo(
    () => ({ ...layoutOptions, direction }),
    [layoutOptions, direction],
  );

  const nodeTypes = useMemo<NodeTypes>(() => ({ nwf: NodeView }), []);
  const positions = useMemo(
    () => dagreLayout(nodes, edges, effectiveLayout),
    [nodes, edges, effectiveLayout],
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
          data: { flat: n, color, state: nodeState?.[n.id], renderNode, vertical } as NodeData,
        };
      }),
    [nodes, positions, sel, renderNode, phaseColors, nodeState, vertical],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: e.kind === 'loop',
        style: edgeStyle?.(e) ?? defaultEdgeStyle(e.kind),
      })),
    [edges, edgeStyle],
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

  const wrapperClass = [
    'nwf-graph',
    theme === 'dark' ? 'nwf-theme-dark' : '',
    vertical ? 'nwf-vertical' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass} style={{ width: '100%', height: '100%', ...style }}>
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
