import { describe, expect, it } from 'vitest';
import { compile } from './compile.js';
import type { IRNode } from './ir/types.js';

// Cast helper: most tests reach into a node's children; the schema is verified
// separately, so loose access here keeps the assertions readable.
// biome-ignore lint/suspicious/noExplicitAny: test ergonomics
const kids = (n: IRNode): any[] => (n as any).children;
const root = (src: string) => compile(src).graph.root;

describe('compile — agent', () => {
  it('compiles a single agent call to an agent node in the root sequence', () => {
    const r = root("await agent('scan the repo', { label: 'scan', model: 'opus' });");
    expect(r.kind).toBe('sequence');
    expect(kids(r)[0]).toMatchObject({
      kind: 'agent',
      prompt: 'scan the repo',
      label: 'scan',
      model: 'opus',
    });
  });

  it('flags the presence of a schema option', () => {
    const a = kids(root('const x = await agent("go", { schema: FOO });'))[0];
    expect(a).toMatchObject({ kind: 'agent', prompt: 'go', hasSchema: true });
  });

  it('sets prompt to null when the prompt is a dynamic template', () => {
    const a = kids(root('await agent(`do ${x}`);'))[0];
    expect(a).toMatchObject({ kind: 'agent', prompt: null });
  });
});

describe('compile — parallel', () => {
  it('compiles parallel of thunks to a parallel node with one lane per element', () => {
    const p = kids(root("await parallel([() => agent('a'), () => agent('b')]);"))[0];
    expect(p.kind).toBe('parallel');
    expect(p.children.map((c: IRNode) => c.kind)).toEqual(['agent', 'agent']);
    expect(p.children.map((c: { prompt: string }) => c.prompt)).toEqual(['a', 'b']);
  });
});

describe('compile — phase tagging', () => {
  it('tags nodes with the phase declared by the most recent phase() call', () => {
    const [a, b] = kids(root("phase('Scan'); await agent('a'); phase('Fix'); await agent('b');"));
    expect(a).toMatchObject({ kind: 'agent', phase: 'Scan' });
    expect(b).toMatchObject({ kind: 'agent', phase: 'Fix' });
  });
});

describe('compile — log', () => {
  it('compiles a log call to a note node', () => {
    const n = kids(root("log('starting run');"))[0];
    expect(n).toMatchObject({ kind: 'note', text: 'starting run' });
  });
});

describe('compile — pipeline', () => {
  it('compiles a pipeline with a symbolic item source and mapped stages', () => {
    const p = kids(root("await pipeline(sources, (s) => agent('extract'));"))[0];
    expect(p).toMatchObject({
      kind: 'pipeline',
      items: { kind: 'symbolic', sourceText: 'sources' },
    });
    expect(p.stages.map((s: IRNode) => s.kind)).toEqual(['agent']);
    expect(p.stages[0]).toMatchObject({ prompt: 'extract' });
  });

  it('reports a static multiplicity when the item source is an array literal', () => {
    const p = kids(root("await pipeline([a, b, c], (s) => agent('go'));"))[0];
    expect(p).toMatchObject({ kind: 'pipeline', items: { kind: 'static', n: 3 } });
  });
});

describe('compile — workflow', () => {
  it('compiles a workflow call to a workflow node', () => {
    const w = kids(root("await workflow('sub-flow', x);"))[0];
    expect(w).toMatchObject({ kind: 'workflow', name: 'sub-flow' });
  });
});

describe('compile — branch', () => {
  it('compiles an if statement to a branch node with a consequent', () => {
    const b = kids(root("if (ready) { await agent('go'); }"))[0];
    expect(b).toMatchObject({ kind: 'branch', conditionText: 'ready' });
    expect(b.consequent.kind).toBe('sequence');
    expect(kids(b.consequent)[0]).toMatchObject({ kind: 'agent', prompt: 'go' });
  });

  it('captures the else arm as the alternate', () => {
    const b = kids(root("if (ok) { await agent('a'); } else { await agent('b'); }"))[0];
    expect(kids(b.consequent)[0]).toMatchObject({ prompt: 'a' });
    expect(kids(b.alternate)[0]).toMatchObject({ prompt: 'b' });
  });
});

describe('compile — loop', () => {
  it('compiles a while loop to a loop node', () => {
    const l = kids(root("while (more) { await agent('again'); }"))[0];
    expect(l).toMatchObject({ kind: 'loop', repeat: { kind: 'while', conditionText: 'more' } });
    expect(kids(l.body)[0]).toMatchObject({ kind: 'agent', prompt: 'again' });
  });

  it('compiles a for loop to a loop node with kind "for"', () => {
    const l = kids(root("for (let i = 0; i < n; i++) { await agent('x'); }"))[0];
    expect(l).toMatchObject({ kind: 'loop', repeat: { kind: 'for' } });
  });
});

describe('compile — terminal', () => {
  it('compiles a return statement to a terminal node', () => {
    const t = kids(root('return result;'))[0];
    expect(t).toMatchObject({ kind: 'terminal', reason: 'return' });
  });
});

describe('compile — plumbing & fallback', () => {
  it('silently drops non-workflow variable/expression statements (data plumbing)', () => {
    const result = compile("const total = a + b * c; helper(); await agent('go');");
    expect(kids(result.graph.root).map((n: IRNode) => n.kind)).toEqual(['agent']);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('emits a code node and a diagnostic for an unhandled statement type', () => {
    const result = compile('throw boom;');
    expect(kids(result.graph.root)[0]).toMatchObject({ kind: 'code' });
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
