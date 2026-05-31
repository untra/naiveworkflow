import '@xyflow/react/dist/style.css';
import '@untra/naiveworkflow-react/styles.css';

import { compile } from '@untra/naiveworkflow-compiler';
import { type FlatNode, WorkflowGraph } from '@untra/naiveworkflow-react';
import { useMemo, useState } from 'react';
import { type Example, examples } from './examples/index.js';

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
          color: '#9aa3b8',
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

function ToolbarButton({
  example,
  active,
  onClick,
}: {
  example: Example;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: mono,
        fontSize: 12,
        padding: '6px 12px',
        borderRadius: 6,
        cursor: 'pointer',
        border: `1px solid ${active ? '#6ea8fe' : '#262b3a'}`,
        background: active ? '#1b2740' : '#12141d',
        color: active ? '#e6e9f2' : '#9aa3b8',
      }}
    >
      {example.name}
    </button>
  );
}

export function App() {
  const [exampleId, setExampleId] = useState(examples[0]!.id);
  const [selected, setSelected] = useState<FlatNode | null>(null);

  const example = examples.find((e) => e.id === exampleId) ?? examples[0]!;
  const { meta, graph, diagnostics } = useMemo(() => compile(example.source), [example.source]);

  // Clear the inspector when switching examples — node ids don't carry across.
  const onSelectExample = (id: string) => {
    setExampleId(id);
    setSelected(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: sans, color: '#e6e9f2' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid #262b3a',
          background: '#0d0f16',
        }}
      >
        <span style={{ fontSize: 12, color: '#626a80', marginRight: 4 }}>workflow .js →</span>
        {examples.map((e) => (
          <ToolbarButton
            key={e.id}
            example={e}
            active={e.id === exampleId}
            onClick={() => onSelectExample(e.id)}
          />
        ))}
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <WorkflowGraph
            graph={graph}
            meta={meta}
            theme="light"
            selectedId={selected?.id ?? null}
            onNodeClick={(n) => setSelected(n)}
            verticalRender
          />
        </div>
        <aside
          style={{
            width: 340,
            borderLeft: '1px solid #262b3a',
            padding: 20,
            overflow: 'auto',
            background: '#12141d',
          }}
        >
          <h1 style={{ fontSize: 16, margin: '0 0 2px' }}>{meta?.name ?? example.name}</h1>
          <p style={{ fontSize: 13, color: '#9aa3b8', marginTop: 0 }}>{meta?.description ?? ''}</p>

          {diagnostics.length > 0 ? (
            <div
              style={{
                margin: '12px 0',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #5a4a2a',
                background: '#1d1810',
                fontSize: 12,
                color: '#e8c468',
              }}
            >
              <strong>{diagnostics.length} construct(s) degraded:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {diagnostics.map((d) => (
                  <li key={`${d.code}:${d.line}:${d.column}`} style={{ fontFamily: mono }}>
                    {d.message}
                    {d.line ? ` (line ${d.line})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <hr style={{ border: 0, borderTop: '1px solid #262b3a', margin: '14px 0' }} />
          {selected ? (
            <Inspector node={selected} />
          ) : (
            <p style={{ color: '#626a80', fontSize: 13 }}>Click a node to inspect it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
