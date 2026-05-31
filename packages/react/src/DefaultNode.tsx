/**
 * The default node body — a slim card with a solid phase-color pill chip, a
 * monospace label, and small agentType/model/multiplicity badges. Fully
 * theme-able through `--nwf-*` CSS variables (see styles.css); ships `light` and
 * `dark` presets. Consumers who want a different look pass `renderNode` to
 * <WorkflowGraph> and bypass this entirely.
 *
 * Handles are provided by the registered node type (WorkflowGraph), not here,
 * so a custom `renderNode` still gets edge connection points for free.
 */

import type { CSSProperties } from 'react';
import type { FlatNode } from './flatten.js';

/** Optional, consumer-driven visual state. There is no built-in simulation. */
export type NodeState = 'idle' | 'running' | 'done';

export interface DefaultNodeBodyProps {
  flat: FlatNode;
  selected: boolean;
  /** Phase accent color, applied as the `--nwf-phase-color` CSS variable. */
  color?: string;
  /** Optional highlight state, applied as an `nwf-{state}` class. */
  state?: NodeState;
}

export function DefaultNodeBody({ flat, selected, color, state }: DefaultNodeBodyProps) {
  const chips = [flat.agentType, flat.model, flat.badge].filter(Boolean) as string[];
  const className = [
    'nwf-node',
    `nwf-kind-${flat.kind}`,
    selected ? 'nwf-selected' : '',
    state ? `nwf-${state}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={color ? ({ '--nwf-phase-color': color } as CSSProperties) : undefined}
      title={flat.label}
    >
      {flat.phase ? <div className="nwf-node-phase">{flat.phase}</div> : null}
      <div className="nwf-node-label">{flat.label}</div>
      {chips.length > 0 ? (
        <div className="nwf-node-badges">
          {chips.map((c) => (
            <span key={c} className="nwf-node-badge">
              {c}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
