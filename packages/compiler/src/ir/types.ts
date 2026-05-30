/**
 * IR types. The zod schemas in `./schema` are the runtime source of truth; the
 * recursive node interfaces are hand-written here because `z.infer` cannot
 * derive a recursive type on its own. Keep the two in sync — `./schema` is
 * statically checked against `IRNode` via `z.ZodType<IRNode>`.
 */

/** A phase declared in the workflow's `meta.phases`. */
export interface Phase {
  title: string;
  detail?: string;
}

/** The statically-extracted `export const meta = {...}` block. */
export interface Meta {
  name: string | null;
  description: string | null;
  phases: Phase[];
}

/**
 * How many times a fan-out/pipeline repeats. `static` when the collection size
 * is statically known (`[a,b,c].map`), `symbolic` otherwise (`findings.map`) —
 * the renderer shows `sourceText` as a `×N` badge.
 */
export type Multiplicity = { kind: 'static'; n: number } | { kind: 'symbolic'; sourceText: string };

/** A loop's repeat condition; rendered as `↻ <kind> <conditionText>`. */
export interface Repeat {
  kind: 'while' | 'until' | 'for';
  conditionText: string;
}

/** Fields shared by every IR node. */
interface NodeBase {
  /** Stable path-based id, e.g. `root/2/parallel/0`. */
  id: string;
  /** Phase this node belongs to (from a preceding `phase()` call), if any. */
  phase?: string;
  /** Source slice this node was produced from (for labels/snippets). */
  source?: string;
}

/** A single `agent(...)` call. */
export interface AgentNode extends NodeBase {
  kind: 'agent';
  /** First string argument, or null when the prompt is dynamic. */
  prompt: string | null;
  label?: string;
  model?: string;
  agentType?: string;
  isolation?: string;
  /** Whether the call passed a `schema` option. */
  hasSchema?: boolean;
}

/** Ordered steps that run one after another. */
export interface SequenceNode extends NodeBase {
  kind: 'sequence';
  children: IRNode[];
}

/** `parallel([...])` — concurrent lanes with a join barrier afterwards. */
export interface ParallelNode extends NodeBase {
  kind: 'parallel';
  children: IRNode[];
}

/** `pipeline(items, ...stages)` — items flow through stages with no barrier. */
export interface PipelineNode extends NodeBase {
  kind: 'pipeline';
  items: Multiplicity;
  stages: IRNode[];
}

/** A `.map`/`.flatMap`/`.filter`/`.forEach` fan-out over a collection. */
export interface FanoutNode extends NodeBase {
  kind: 'fanout';
  op: 'map' | 'flatMap' | 'filter' | 'forEach';
  multiplicity: Multiplicity;
  body: IRNode;
}

/** A loop (`while`/`for`/`for..of`). Not unrolled. */
export interface LoopNode extends NodeBase {
  kind: 'loop';
  repeat: Repeat;
  body: IRNode;
}

/** An `if`/ternary/`&&` that guards workflow steps. */
export interface BranchNode extends NodeBase {
  kind: 'branch';
  conditionText: string;
  consequent: IRNode;
  alternate?: IRNode | null;
}

/** An early `return`/exit. */
export interface TerminalNode extends NodeBase {
  kind: 'terminal';
  reason: 'return' | 'exit';
}

/** A `phase(title)` grouping band. */
export interface PhaseNode extends NodeBase {
  kind: 'phase';
  title: string;
  children: IRNode[];
}

/** A nested `workflow(name, args)` call. */
export interface WorkflowNode extends NodeBase {
  kind: 'workflow';
  name: string | null;
  args?: string;
}

/** A `log(...)` call — a small annotation chip, not flow. */
export interface NoteNode extends NodeBase {
  kind: 'note';
  text: string | null;
}

/** Fallback for JS the visitor could not classify. Never thrown over. */
export interface CodeNode extends NodeBase {
  kind: 'code';
  source: string;
  note?: string;
}

export type IRNode =
  | AgentNode
  | SequenceNode
  | ParallelNode
  | PipelineNode
  | FanoutNode
  | LoopNode
  | BranchNode
  | TerminalNode
  | PhaseNode
  | WorkflowNode
  | NoteNode
  | CodeNode;

export interface IRGraph {
  root: IRNode;
}

/** A non-fatal event raised while compiling (e.g. an unrecognized construct). */
export interface Diagnostic {
  code: string;
  message: string;
  line?: number;
  column?: number;
}

export interface CompileResult {
  meta: Meta | null;
  graph: IRGraph;
  diagnostics: Diagnostic[];
}
