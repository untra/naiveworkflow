/**
 * @untra/naiveworkflow-react
 *
 * Renders a naiveworkflow IR as a flat, clickable dependency graph: flattens
 * the nested IR (`flattenIR`), lays it out with dagre (`dagreLayout`), and
 * draws it with React Flow (`<WorkflowGraph>`). Slim by design — node visuals
 * (`renderNode`), click behavior (`onNodeClick`), the bundled `theme`
 * ('light' | 'dark'), `phaseColors`, `edgeStyle`, and `nodeState` are all
 * configurable so the component drops into any embedder's aesthetic.
 *
 * Two entry points: `<WorkflowGraph graph={ir} />` takes IR from the safe static
 * parser (`@untra/naiveworkflow-compiler`); `<WorkflowFlow nodes edges />` takes
 * a pre-flattened node/edge list (bring your own producer).
 *
 * Optional stylesheet: `import '@untra/naiveworkflow-react/styles.css'`
 * (plus React Flow's own `import '@xyflow/react/dist/style.css'`).
 */

export const RENDERER_VERSION = '0.1.0';

export { DefaultNodeBody, type DefaultNodeBodyProps, type NodeState } from './DefaultNode.js';
export {
  type FlatEdge,
  type FlatEdgeKind,
  type FlatGraph,
  type FlatNode,
  type FlatNodeKind,
  flattenIR,
} from './flatten.js';
export { dagreLayout, type LayoutOptions, type Position } from './layout.js';
export {
  type Theme,
  WorkflowFlow,
  type WorkflowFlowProps,
  WorkflowGraph,
  type WorkflowGraphProps,
} from './WorkflowGraph.js';
