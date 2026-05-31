/**
 * The default node body. Deliberately minimal and fully theme-able through CSS
 * variables (see styles.css) — no hard-coded palette. Consumers who want a
 * different look pass `renderNode` to <WorkflowGraph> and bypass this entirely.
 *
 * Handles are provided by the registered node type (WorkflowGraph), not here,
 * so a custom `renderNode` still gets edge connection points for free.
 */

import type { FlatNode } from './flatten.js';

export interface DefaultNodeBodyProps {
  flat: FlatNode;
  selected: boolean;
  /** Phase accent color, applied as the `--nwf-phase-color` CSS variable. */
  color?: string;
}

export function DefaultNodeBody({ flat, selected, color }: DefaultNodeBodyProps) {
  const chips = [flat.agentType, flat.model, flat.badge].filter(Boolean) as string[];
  return (
    <div
      className={`nwf-node${selected ? ' nwf-selected' : ''}`}
      style={color ? ({ '--nwf-phase-color': color } as React.CSSProperties) : undefined}
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
