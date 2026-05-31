import { cleanup, fireEvent, render, screen } from '@testing-library/react';
// @vitest-environment jsdom
import type { IRGraph, IRNode } from '@untra/naiveworkflow-compiler/ir';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FlatNode } from './flatten.js';
import { WorkflowGraph } from './WorkflowGraph.js';

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

  it('applies the dark theme class by default and omits it for theme="light"', () => {
    const { container, rerender } = render(<WorkflowGraph graph={fixture} />);
    expect(container.querySelector('.nwf-graph.nwf-theme-dark')).not.toBeNull();
    rerender(<WorkflowGraph graph={fixture} theme="light" />);
    expect(container.querySelector('.nwf-theme-dark')).toBeNull();
    expect(container.querySelector('.nwf-graph')).not.toBeNull();
  });

  it('defaults to a horizontal layout with left/right edge handles', () => {
    const { container } = render(<WorkflowGraph graph={fixture} />);
    expect(container.querySelector('.nwf-graph.nwf-vertical')).toBeNull();
    expect(container.querySelector('.react-flow__handle-left')).not.toBeNull();
    expect(container.querySelector('.react-flow__handle-right')).not.toBeNull();
  });

  it('renders top-to-bottom with top/bottom edge handles when verticalRender is set', () => {
    const { container } = render(<WorkflowGraph graph={fixture} verticalRender />);
    expect(container.querySelector('.nwf-graph.nwf-vertical')).not.toBeNull();
    expect(container.querySelector('.react-flow__handle-top')).not.toBeNull();
    expect(container.querySelector('.react-flow__handle-bottom')).not.toBeNull();
  });

  it('applies a consumer-driven nodeState class to the matching node', () => {
    const { container } = render(<WorkflowGraph graph={fixture} nodeState={{ a: 'running' }} />);
    expect(container.querySelector('.nwf-node.nwf-running')).not.toBeNull();
    // unspecified nodes carry no state class
    expect(container.querySelectorAll('.nwf-node.nwf-running')).toHaveLength(1);
  });
});
