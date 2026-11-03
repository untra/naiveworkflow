import type { FlatEdge, FlatNode } from './flatten.js';

interface WorkflowDetailsProps {
  nodes: FlatNode[];
  edges: FlatEdge[];
}

export function WorkflowDetails({ nodes, edges }: WorkflowDetailsProps) {
  const labels = new Map(nodes.map((node) => [node.id, node.fullLabel ?? node.label]));
  const describe = (id: string) => `${labels.get(id) ?? 'Unknown node'} (${id})`;
  return (
    <details className="nwf-details">
      <summary>Workflow details</summary>
      <h2>Nodes</h2>
      {nodes.length === 0 ? (
        <p>No workflow nodes.</p>
      ) : (
        <ol>
          {nodes.map((node) => (
            <li key={node.id}>
              <strong>{node.fullLabel ?? node.label}</strong> ({node.id})
              <dl>
                <dt>Kind</dt>
                <dd>{node.kind}</dd>
                {Object.entries({
                  Phase: node.phase,
                  'Agent type': node.agentType,
                  Model: node.model,
                  Isolation: node.isolation,
                  Multiplicity: node.badge,
                  Prompt: node.prompt,
                  Source: node.source,
                }).map(([name, value]) =>
                  value ? (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{value}</dd>
                    </div>
                  ) : null,
                )}
                {node.hasSchema !== undefined ? (
                  <>
                    <dt>Schema</dt>
                    <dd>{node.hasSchema ? 'Yes' : 'No'}</dd>
                  </>
                ) : null}
              </dl>
            </li>
          ))}
        </ol>
      )}
      <h2>Connections</h2>
      {edges.length === 0 ? (
        <p>No workflow connections.</p>
      ) : (
        <ul>
          {edges.map((edge) => (
            <li key={edge.id}>
              {describe(edge.source)} → {describe(edge.target)} ({edge.kind})
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
