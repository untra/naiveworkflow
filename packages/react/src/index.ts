/**
 * @naiveworkflow/react
 *
 * Renders a naiveworkflow IR as a flat, clickable dependency graph: flattens
 * the nested IR (`flattenIR`), lays it out with dagre (`dagreLayout`), and
 * draws it with React Flow (`<WorkflowGraph>`). Minimal by design — node-click
 * behavior (`onNodeClick`) and node visuals (`renderNode`) are configurable so
 * the component drops into any embedder's aesthetic.
 *
 * Optional stylesheet: `import '@naiveworkflow/react/styles.css'`
 * (plus React Flow's own `import '@xyflow/react/dist/style.css'`).
 */

export const RENDERER_VERSION = '0.1.0';

export {
  WorkflowGraph,
  WorkflowFlow,
  type WorkflowGraphProps,
  type WorkflowFlowProps,
} from './WorkflowGraph.js';
export { DefaultNodeBody, type DefaultNodeBodyProps } from './DefaultNode.js';
export {
  flattenIR,
  type FlatGraph,
  type FlatNode,
  type FlatEdge,
  type FlatNodeKind,
  type FlatEdgeKind,
} from './flatten.js';
export { dagreLayout, type LayoutOptions, type Position } from './layout.js';
