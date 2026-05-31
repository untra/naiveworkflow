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

export {
  WorkflowGraph,
  WorkflowFlow,
  type WorkflowGraphProps,
  type WorkflowFlowProps,
  type Theme,
} from './WorkflowGraph.js';
export { DefaultNodeBody, type DefaultNodeBodyProps, type NodeState } from './DefaultNode.js';
export {
  flattenIR,
  type FlatGraph,
  type FlatNode,
  type FlatEdge,
  type FlatNodeKind,
  type FlatEdgeKind,
} from './flatten.js';
export { dagreLayout, type LayoutOptions, type Position } from './layout.js';
