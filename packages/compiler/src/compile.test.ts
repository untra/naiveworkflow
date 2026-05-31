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
