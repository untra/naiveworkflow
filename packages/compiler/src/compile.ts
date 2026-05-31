/**
 * compile() — the AST → IR visitor. Parses a Claude workflow module with acorn
 * (never executing it) and walks the statement tree into a coordinate-free
 * `IRGraph`. The program body becomes the root `sequence`; recognized workflow
 * primitives (`agent`/`parallel`/`pipeline`/`log`/`workflow`) and the control
 * flow that wraps them (`if`/`while`/`for`/`return`) map to IR nodes. `phase()`
 * calls tag the nodes that follow them. Anything unrecognized degrades to a
 * `code` node plus a diagnostic — the visitor never throws over the source.
 */

import type {
  Expression,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  Node,
  Program,
  SpreadElement,
} from 'estree';
import { DiagnosticSink } from './diagnostics.js';
import { indexProps, stringProp } from './eval.js';
import type {
  AgentNode,
  BranchNode,
  CodeNode,
  CompileResult,
  IRNode,
  LoopNode,
  Multiplicity,
  NoteNode,
  ParallelNode,
  PipelineNode,
  SequenceNode,
  TerminalNode,
  WorkflowNode,
} from './ir/types.js';
import { extractMeta } from './meta.js';
import { parseModule } from './parse.js';
import { conditionText, firstStringArg, sliceNode } from './source-text.js';

/** A program/block body element — `Statement | ModuleDeclaration | Directive`. */
type Stmt = Program['body'][number];

interface Ctx {
  source: string;
  sink: DiagnosticSink;
}

/** Stamp the active phase onto a node, when one is in effect. */
function tag<T extends IRNode>(node: T, phase: string | undefined): T {
  if (phase) node.phase = phase;
  return node;
}

/** When `stmt` is a bare `phase('X')` call, return its (possibly null) title. */
function phaseTitle(stmt: Stmt): { matched: boolean; title: string | null } {
  if (stmt.type !== 'ExpressionStatement') return { matched: false, title: null };
  let e: Expression = stmt.expression;
  if (e.type === 'AwaitExpression') e = e.argument;
  if (e.type === 'CallExpression' && e.callee.type === 'Identifier' && e.callee.name === 'phase') {
    return { matched: true, title: firstStringArg(e.arguments) };
  }
  return { matched: false, title: null };
}

/** Fallback for any construct the visitor cannot classify — never thrown over. */
function codeNode(node: Node, path: string, phase: string | undefined, ctx: Ctx): CodeNode {
  ctx.sink.add('unsupported', `unrecognized construct: ${node.type}`, node);
  return tag({ id: path, kind: 'code', source: sliceNode(node, ctx.source) }, phase);
}

const isThunk = (
  el: Expression,
): el is Expression & { type: 'ArrowFunctionExpression' | 'FunctionExpression' } =>
  el.type === 'ArrowFunctionExpression' || el.type === 'FunctionExpression';

/** Multiplicity of a fan-through source: static for an array literal, else symbolic. */
function multiplicityOf(arg: Expression | SpreadElement | undefined, ctx: Ctx): Multiplicity {
  if (arg && arg.type === 'ArrayExpression') return { kind: 'static', n: arg.elements.length };
  if (arg && arg.type !== 'SpreadElement') {
    return { kind: 'symbolic', sourceText: conditionText(arg, ctx.source) };
  }
  return { kind: 'symbolic', sourceText: '' };
}

export function compile(source: string): CompileResult {
  const { program } = parseModule(source);
  const meta = extractMeta(program, source);
  const ctx: Ctx = { source, sink: new DiagnosticSink() };

  /** Walk an ordered statement list into IR children, tracking `phase()` tags. */
  function walkStatements(stmts: Stmt[], pathPrefix: string, inherited: string | undefined): IRNode[] {
    let phase = inherited;
    const out: IRNode[] = [];
    let i = 0;
    for (const stmt of stmts) {
      const ph = phaseTitle(stmt);
      if (ph.matched) {
        if (ph.title) phase = ph.title;
        continue;
      }
      const node = walkStatement(stmt, `${pathPrefix}/${i}`, phase);
      if (node) {
        out.push(node);
        i += 1;
      }
    }
    return out;
  }

  /** Wrap a block (or single statement) as a `sequence` node. */
  function blockToSequence(stmt: Stmt, path: string, phase: string | undefined): SequenceNode {
    const body = stmt.type === 'BlockStatement' ? stmt.body : [stmt];
    return tag({ id: path, kind: 'sequence', children: walkStatements(body, path, phase) }, phase);
  }

  function walkStatement(stmt: Stmt, path: string, phase: string | undefined): IRNode | null {
    switch (stmt.type) {
      // Module declarations (incl. `export const meta`) and directives carry no flow.
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        return null;

      // Expression/variable statements only contribute a node when they resolve
      // to a workflow construct; otherwise they are data plumbing — dropped.
      case 'ExpressionStatement':
        return classifyExpr(stmt.expression, path, phase);

      case 'VariableDeclaration': {
        const init = stmt.declarations[0]?.init;
        return init ? classifyExpr(init, path, phase) : null;
      }

      case 'IfStatement': {
        const node: BranchNode = {
          id: path,
          kind: 'branch',
          conditionText: conditionText(stmt.test, ctx.source),
          consequent: blockToSequence(stmt.consequent, `${path}/then`, phase),
          alternate: stmt.alternate ? blockToSequence(stmt.alternate, `${path}/else`, phase) : null,
        };
        return tag(node, phase);
      }

      case 'WhileStatement':
      case 'DoWhileStatement': {
        const node: LoopNode = {
          id: path,
          kind: 'loop',
          repeat: { kind: 'while', conditionText: conditionText(stmt.test, ctx.source) },
          body: blockToSequence(stmt.body, `${path}/body`, phase),
        };
        return tag(node, phase);
      }

      case 'ForStatement':
      case 'ForOfStatement':
      case 'ForInStatement': {
        const node: LoopNode = {
          id: path,
          kind: 'loop',
          repeat: { kind: 'for', conditionText: forHeader(stmt, ctx.source) },
          body: blockToSequence(stmt.body, `${path}/body`, phase),
        };
        return tag(node, phase);
      }

      case 'ReturnStatement':
        return tag({ id: path, kind: 'terminal', reason: 'return' } as TerminalNode, phase);

      case 'BlockStatement':
        return blockToSequence(stmt, path, phase);

      default:
        return codeNode(stmt, path, phase, ctx);
    }
  }

  /**
   * Classify a (possibly awaited) expression into an IR node, or null when it
   * is not a recognized workflow construct (plain data — not workflow flow).
   */
  function classifyExpr(expr: Expression, path: string, phase: string | undefined): IRNode | null {
    if (expr.type === 'AwaitExpression') return classifyExpr(expr.argument, path, phase);
    if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
      const args = expr.arguments;
      switch (expr.callee.name) {
        case 'agent':
          return agentNode(args, path, phase);
        case 'parallel':
          return parallelNode(args, path, phase);
        case 'pipeline':
          return pipelineNode(args, path, phase);
        case 'log':
          return tag({ id: path, kind: 'note', text: firstStringArg(args) } as NoteNode, phase);
        case 'workflow':
          return workflowNode(args, path, phase);
      }
    }
    return null;
  }

  function agentNode(
    args: Array<Expression | SpreadElement>,
    path: string,
    phase: string | undefined,
  ): AgentNode {
    const node: AgentNode = { id: path, kind: 'agent', prompt: firstStringArg(args) };
    const opts = args[1];
    if (opts && opts.type === 'ObjectExpression') {
      const props = indexProps(opts);
      const label = stringProp(props, 'label');
      const model = stringProp(props, 'model');
      const agentType = stringProp(props, 'agentType');
      const isolation = stringProp(props, 'isolation');
      if (label) node.label = label;
      if (model) node.model = model;
      if (agentType) node.agentType = agentType;
      if (isolation) node.isolation = isolation;
      if (props.has('schema')) node.hasSchema = true;
    }
    return tag(node, phase);
  }

  function parallelNode(
    args: Array<Expression | SpreadElement>,
    path: string,
    phase: string | undefined,
  ): ParallelNode {
    const children: IRNode[] = [];
    const first = args[0];
    if (first && first.type === 'ArrayExpression') {
      first.elements.forEach((el, i) => {
        if (!el || el.type === 'SpreadElement') return;
        const child = classifyElement(el, `${path}/parallel/${i}`, phase);
        if (child) children.push(child);
      });
    }
    return tag({ id: path, kind: 'parallel', children }, phase);
  }

  function pipelineNode(
    args: Array<Expression | SpreadElement>,
    path: string,
    phase: string | undefined,
  ): PipelineNode {
    const stages: IRNode[] = [];
    args.slice(1).forEach((arg, i) => {
      const child = classifyElement(arg, `${path}/pipeline/${i}`, phase);
      if (child) stages.push(child);
    });
    return tag(
      { id: path, kind: 'pipeline', items: multiplicityOf(args[0], ctx), stages },
      phase,
    );
  }

  function workflowNode(
    args: Array<Expression | SpreadElement>,
    path: string,
    phase: string | undefined,
  ): WorkflowNode {
    const node: WorkflowNode = { id: path, kind: 'workflow', name: firstStringArg(args) };
    const second = args[1];
    if (second && second.type !== 'SpreadElement') node.args = conditionText(second, ctx.source);
    return tag(node, phase);
  }

  /** A lane/stage element: unwrap a thunk to its body, else classify directly. */
  function classifyElement(
    el: Expression | SpreadElement,
    path: string,
    phase: string | undefined,
  ): IRNode | null {
    if (el.type === 'SpreadElement') return null;
    if (isThunk(el)) {
      return el.body.type === 'BlockStatement'
        ? blockToSequence(el.body, path, phase)
        : classifyExpr(el.body, path, phase);
    }
    return classifyExpr(el, path, phase);
  }

  const children = walkStatements(program.body, 'root', undefined);
  return {
    meta,
    graph: { root: { id: 'root', kind: 'sequence', children } },
    diagnostics: ctx.sink.all(),
  };
}

/** A readable one-line label for a `for`/`for..of`/`for..in` header. */
function forHeader(
  stmt: ForStatement | ForOfStatement | ForInStatement,
  source: string,
): string {
  if (stmt.type === 'ForStatement') return stmt.test ? conditionText(stmt.test, source) : '';
  const keyword = stmt.type === 'ForOfStatement' ? 'of' : 'in';
  return `${conditionText(stmt.left, source)} ${keyword} ${conditionText(stmt.right, source)}`;
}
