import type { IRGraph, IRNode } from '@untra/naiveworkflow-compiler/ir';
import {
  DefaultNodeBody,
  flattenIR,
  WorkflowFlow,
  WorkflowGraph,
} from '@untra/naiveworkflow-react';
import { Background, Controls, Panel, useViewport } from '@xyflow/react';
import { useMemo, useState } from 'react';
import './audit.css';

const LONG_NODE_COUNT = 30;
const LONG_LABEL =
  'Review all findings and document the dependencies and their relationships. '.repeat(3);

function ViewportStatus() {
  const viewport = useViewport();
  return (
    <Panel position="bottom-right">
      <output aria-label="Viewport">{JSON.stringify(viewport)}</output>
    </Panel>
  );
}

function fixtureGraph(fixture: string): IRGraph {
  const agent = (id: string, label: string): IRNode => ({
    id,
    kind: 'agent',
    label,
    prompt: `Instructions for ${label}`,
    phase: 'Research',
    model: 'example-model',
    agentType: 'researcher',
    hasSchema: true,
  });
  if (fixture === 'empty') return { root: { id: 'root', kind: 'sequence', children: [] } };
  if (fixture === 'long')
    return {
      root: {
        id: 'root',
        kind: 'sequence',
        children: Array.from({ length: LONG_NODE_COUNT }, (_, index) =>
          agent(`long-${index}`, `${index + 1}: ${LONG_LABEL}`),
        ),
      },
    };
  return {
    root: {
      id: 'root',
      kind: 'sequence',
      children: [
        agent('a', 'Find sources'),
        {
          id: 'parallel',
          kind: 'parallel',
          children: [agent('b', 'Review sources'), agent('c', 'Check evidence')],
        },
        {
          id: 'loop',
          kind: 'loop',
          repeat: { kind: 'until', conditionText: 'complete' },
          body: agent('d', 'Synthesize'),
        },
      ],
    },
  };
}

export function Audit() {
  const [readOnly, setReadOnly] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fixture, setFixture] = useState('basic');
  const [vertical, setVertical] = useState(false);
  const [controlled, setControlled] = useState(false);
  const [wrapper, setWrapper] = useState('flow');
  const [customControls, setCustomControls] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [doubleClicks, setDoubleClicks] = useState(0);
  const [actions, setActions] = useState(0);
  const [revision, setRevision] = useState(0);
  const graph = useMemo(() => fixtureGraph(fixture), [fixture]);
  const flat = useMemo(() => flattenIR(graph), [graph]);
  const props = {
    readOnly,
    theme,
    verticalRender: vertical,
    selectedId: controlled ? 'a' : undefined,
    onNodeClick: () => setClicks((count) => count + 1),
    onNodeDoubleClick: () => setDoubleClicks((count) => count + 1),
    nodeState: fixture === 'basic' ? { d: 'running' as const } : undefined,
    children: (
      <>
        <Background />
        <ViewportStatus />
        {customControls ? <Controls /> : null}
      </>
    ),
  };
  return (
    <main className="audit" data-theme={theme}>
      <h1>Workflow accessibility examples</h1>
      <div className="audit-toolbar">
        <label>
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(event) => setReadOnly(event.target.checked)}
          />
          Read only
        </label>
        <label>
          Theme
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value === 'dark' ? 'dark' : 'light')}
          >
            <option>light</option>
            <option>dark</option>
          </select>
        </label>
        <label>
          Fixture
          <select value={fixture} onChange={(event) => setFixture(event.target.value)}>
            <option>basic</option>
            <option>long</option>
            <option>empty</option>
          </select>
        </label>
        <label>
          Wrapper
          <select value={wrapper} onChange={(event) => setWrapper(event.target.value)}>
            <option>flow</option>
            <option>graph</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={vertical}
            onChange={(event) => setVertical(event.target.checked)}
          />
          Vertical
        </label>
        <label>
          <input
            type="checkbox"
            checked={controlled}
            onChange={(event) => setControlled(event.target.checked)}
          />
          Controlled selection
        </label>
        <label>
          <input
            type="checkbox"
            checked={customControls}
            onChange={(event) => setCustomControls(event.target.checked)}
          />
          Consumer controls
        </label>
        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          Rerender
        </button>
      </div>
      <p>
        Revision {revision}. Clicks: <output aria-label="Click count">{clicks}</output>. Double
        clicks: <output aria-label="Double click count">{doubleClicks}</output>. Custom actions:{' '}
        <output aria-label="Custom action count">{actions}</output>.
      </p>
      <div className="audit-graph">
        {wrapper === 'graph' ? (
          <WorkflowGraph graph={graph} {...props} />
        ) : (
          <WorkflowFlow
            nodes={flat.nodes}
            edges={flat.edges}
            {...props}
            renderNode={(node, state) => (
              <>
                <DefaultNodeBody flat={node} selected={state.selected} />
                {node.id === 'a' ? (
                  <button
                    type="button"
                    className="nodrag nopan"
                    onClick={() => setActions((count) => count + 1)}
                  >
                    Custom action
                  </button>
                ) : null}
              </>
            )}
          />
        )}
      </div>
    </main>
  );
}
