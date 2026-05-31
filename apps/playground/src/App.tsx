import '@xyflow/react/dist/style.css';
import '@naiveworkflow/react/styles.css';

import { type FlatNode, WorkflowGraph } from '@naiveworkflow/react';
import { useState } from 'react';
import { graph, meta } from './fixture.js';

const mono = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace';
const sans = 'ui-sans-serif, system-ui, sans-serif';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#71717a',
        }}
      >
        {label}
      </div>
      <div
        style={{ fontFamily: mono, fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        {value}
      </div>
    </div>
  );
}

function Inspector({ node }: { node: FlatNode }) {
  return (
    <div>
      <Field label="label" value={node.label} />
      <Field label="kind" value={node.kind} />
      {node.phase ? <Field label="phase" value={node.phase} /> : null}
      {node.agentType ? <Field label="agentType" value={node.agentType} /> : null}
      {node.model ? <Field label="model" value={node.model} /> : null}
      {node.badge ? <Field label="multiplicity" value={node.badge} /> : null}
      <Field label="schema" value={node.hasSchema ? 'yes' : 'no'} />
      {node.prompt ? <Field label="prompt" value={node.prompt} /> : null}
    </div>
  );
}

export function App() {
  const [selected, setSelected] = useState<FlatNode | null>(null);
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: sans, color: '#18181b' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <WorkflowGraph
          graph={graph}
          meta={meta}
          selectedId={selected?.id ?? null}
          onNodeClick={(n) => setSelected(n)}
        />
      </div>
      <aside
        style={{
          width: 340,
          borderLeft: '1px solid #e4e4e7',
          padding: 20,
          overflow: 'auto',
          background: '#fafafa',
        }}
      >
        <h1 style={{ fontSize: 16, margin: '0 0 2px' }}>{meta.name}</h1>
        <p style={{ fontSize: 13, color: '#71717a', marginTop: 0 }}>{meta.description}</p>
        <hr style={{ border: 0, borderTop: '1px solid #e4e4e7', margin: '14px 0' }} />
        {selected ? (
          <Inspector node={selected} />
        ) : (
          <p style={{ color: '#a1a1aa', fontSize: 13 }}>Click a node to inspect it.</p>
        )}
      </aside>
    </div>
  );
}
