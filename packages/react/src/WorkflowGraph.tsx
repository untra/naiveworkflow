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
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DefaultNodeBody, type NodeState } from './DefaultNode.js';
import { type FlatEdge, type FlatNode, flattenIR } from './flatten.js';
import { dagreLayout, type LayoutOptions } from './layout.js';
import { MAX_ZOOM, MIN_ZOOM, ViewportControls } from './ViewportControls.js';
import { WorkflowDetails } from './WorkflowDetails.js';

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
  /** Disable graph editing and node callbacks; external selectedId highlighting remains. */
  readOnly?: boolean;
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

type WorkflowNode = Node<NodeData, 'nwf'>;

/** The single registered node type: provides handles, delegates the body. */
function NodeView(props: NodeProps<WorkflowNode>) {
  const { flat, color, state, renderNode, vertical } = props.data;
  const selected = props.selected ?? false;
  return (
    <>
      <Handle
        type="target"
        position={vertical ? Position.Top : Position.Left}
        isConnectable={props.isConnectable}
        isConnectableStart={props.isConnectable}
        isConnectableEnd={props.isConnectable}
        aria-hidden="true"
      />
      {renderNode ? (
        <div className="nwf-custom-node">{renderNode(flat, { selected })}</div>
      ) : (
        <DefaultNodeBody flat={flat} selected={selected} color={color} state={state} />
      )}
      <Handle
        type="source"
        position={vertical ? Position.Bottom : Position.Right}
        isConnectable={props.isConnectable}
        isConnectableStart={props.isConnectable}
        isConnectableEnd={props.isConnectable}
        aria-hidden="true"
      />
    </>
  );
}

const defaultEdgeStyle = (kind: FlatEdge['kind']): CSSProperties | undefined =>
  kind === 'loop' ? { strokeDasharray: '4 4' } : undefined;

function WorkflowFlowInner({
  nodes,
  edges,
  readOnly = false,
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
  const sel = controlled ? selectedId : readOnly ? null : internalSel;
  const graphId = useId();
  const navigationId = useId();
  const flowRef = useRef<HTMLDivElement>(null);
  if (
    internalSel !== null &&
    (readOnly || controlled || !nodes.some((node) => node.id === internalSel))
  ) {
    setInternalSel(null);
  }

  useEffect(() => {
    const element = flowRef.current;
    if (!element) return;
    // React Flow overwrites the role prop, so synchronize its DOM role here.
    element.setAttribute('role', readOnly ? 'region' : 'application');
    const active = element.ownerDocument.activeElement;
    if (
      readOnly &&
      active instanceof HTMLElement &&
      (active.classList.contains('react-flow__node') ||
        active.classList.contains('react-flow__edge'))
    ) {
      element.focus();
    }
  }, [readOnly]);

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

  const rfNodes = useMemo<WorkflowNode[]>(
    () =>
      nodes.map((n) => {
        const color =
          n.phaseIndex == null ? undefined : phaseColors[n.phaseIndex % phaseColors.length];
        return {
          id: n.id,
          type: 'nwf',
          position: positions[n.id] ?? { x: 0, y: 0 },
          selected: n.id === sel,
          draggable: !readOnly,
          connectable: !readOnly,
          selectable: !readOnly,
          deletable: !readOnly,
          focusable: !readOnly,
          ariaLabel: [
            n.fullLabel ?? n.label,
            n.phase,
            n.agentType,
            n.model,
            n.badge,
            nodeState?.[n.id],
          ]
            .filter(Boolean)
            .join(', '),
          data: { flat: n, color, state: nodeState?.[n.id], renderNode, vertical },
        };
      }),
    [nodes, positions, sel, renderNode, phaseColors, nodeState, vertical, readOnly],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: e.kind === 'loop',
        selectable: !readOnly,
        deletable: !readOnly,
        focusable: !readOnly,
        reconnectable: !readOnly,
        ariaLabel: `${flatById.get(e.source)?.fullLabel ?? flatById.get(e.source)?.label ?? e.source} (${e.source}) to ${flatById.get(e.target)?.fullLabel ?? flatById.get(e.target)?.label ?? e.target} (${e.target}), ${e.kind}`,
        style: edgeStyle?.(e) ?? defaultEdgeStyle(e.kind),
      })),
    [edges, edgeStyle, flatById, readOnly],
  );

  const handleClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      if (readOnly) return;
      const flat = flatById.get(node.id);
      if (!flat) return;
      if (!controlled) setInternalSel(node.id);
      onNodeClick?.(flat, event);
    },
    [flatById, controlled, onNodeClick, readOnly],
  );

  const handleDoubleClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      if (readOnly) return;
      const flat = flatById.get(node.id);
      if (flat) onNodeDoubleClick?.(flat, event);
    },
    [flatById, onNodeDoubleClick, readOnly],
  );

  const wrapperClass = [
    'nwf-graph',
    theme === 'dark' ? 'nwf-theme-dark' : '',
    vertical ? 'nwf-vertical' : '',
    readOnly ? 'nwf-readonly' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass} style={{ width: '100%', height: '100%', ...style }}>
      <ReactFlow
        ref={flowRef}
        id={graphId}
        aria-label="Workflow graph"
        aria-describedby={readOnly ? navigationId : undefined}
        tabIndex={-1}
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleClick}
        onNodeDoubleClick={handleDoubleClick}
        fitView={fitView}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        nodesFocusable={!readOnly}
        edgesFocusable={!readOnly}
        edgesReconnectable={!readOnly}
        elementsSelectable={!readOnly}
        deleteKeyCode={readOnly ? null : 'Backspace'}
        selectionKeyCode={readOnly ? null : 'Shift'}
        multiSelectionKeyCode={readOnly ? null : undefined}
        disableKeyboardA11y={readOnly}
        connectOnClick={!readOnly}
        ariaLabelConfig={
          readOnly
            ? {
                'node.a11yDescription.default': '',
                'node.a11yDescription.keyboardDisabled': '',
                'edge.a11yDescription.default': '',
              }
            : undefined
        }
        proOptions={{ hideAttribution: true }}
      >
        {children ?? <Background />}
        {readOnly ? <ViewportControls empty={nodes.length === 0} /> : null}
      </ReactFlow>
      {readOnly ? (
        <>
          <p id={navigationId} className="nwf-navigation-hint">
            Read-only workflow. Use the pan, zoom, and fit buttons to explore the graph, or expand
            Workflow details to read nodes and connections.
          </p>
          <WorkflowDetails nodes={nodes} edges={edges} />
        </>
      ) : null}
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
