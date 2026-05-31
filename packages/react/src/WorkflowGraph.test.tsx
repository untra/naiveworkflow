// @vitest-environment jsdom
import type { IRGraph, IRNode } from '@naiveworkflow/compiler/ir';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkflowGraph } from './WorkflowGraph.js';
import type { FlatNode } from './flatten.js';

// React Flow needs a few browser APIs jsdom lacks. These are the standard
// @xyflow/react test shims.
beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // biome-ignore lint/suspicious/noExplicitAny: test shim
  (globalThis as any).ResizeObserver = ResizeObserver;
  // biome-ignore lint/suspicious/noExplicitAny: test shim
  (globalThis as any).DOMMatrixReadOnly = class {
    m22 = 1;
  };
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      get() {
        return 200;
      },
    },
    offsetWidth: {
      get() {
        return 400;
      },
    },
  });
  // biome-ignore lint/suspicious/noExplicitAny: test shim
  (SVGElement as any).prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
});

afterEach(cleanup);

const fixture: IRGraph = {
  root: {
    id: 'root',
    kind: 'sequence',
    children: [
      { id: 'a', kind: 'agent', prompt: 'find sources', label: 'find sources' } as IRNode,
      { id: 'b', kind: 'agent', prompt: 'synthesize', label: 'synthesize' } as IRNode,
    ],
  } as IRNode,
};

describe('WorkflowGraph', () => {
  it('renders a node for each leaf in the IR', () => {
    render(<WorkflowGraph graph={fixture} />);
    expect(screen.getByText('find sources')).toBeDefined();
    expect(screen.getByText('synthesize')).toBeDefined();
  });

  it('fires onNodeClick with the clicked FlatNode', () => {
    const onNodeClick = vi.fn<(n: FlatNode) => void>();
    render(<WorkflowGraph graph={fixture} onNodeClick={onNodeClick} />);
    fireEvent.click(screen.getByText('find sources'));
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(onNodeClick.mock.calls[0]?.[0]?.id).toBe('a');
  });

  it('uses renderNode to fully replace the node body when provided', () => {
    render(<WorkflowGraph graph={fixture} renderNode={(n) => <div>custom:{n.label}</div>} />);
    expect(screen.getByText('custom:find sources')).toBeDefined();
  });
});
