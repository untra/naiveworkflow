import type { IRGraph, Meta } from '@untra/naiveworkflow-compiler/ir';

/**
 * A hand-authored IR fixture so the playground can demo the renderer without
 * depending on the (in-progress) `compile()` step. Models a deep-research
 * workflow: a parallel sweep → a per-source read pipeline → a synthesis step.
 */
export const meta: Meta = {
  name: 'deep-research',
  description: 'Fan out searches, read each source, then synthesize a cited report.',
  phases: [{ title: 'Sweep' }, { title: 'Read' }, { title: 'Synthesize' }],
};

export const graph: IRGraph = {
  root: {
    id: 'root',
    kind: 'sequence',
    children: [
      {
        id: 'sweep',
        kind: 'phase',
        title: 'Sweep',
        children: [
          {
            id: 'p',
            kind: 'parallel',
            children: [
              {
                id: 'web',
                kind: 'agent',
                prompt: 'search the web for relevant sources',
                label: 'web search',
                agentType: 'Explore',
                model: 'opus',
              },
              {
                id: 'arxiv',
                kind: 'agent',
                prompt: 'search arXiv for relevant papers',
                label: 'arxiv search',
                agentType: 'Explore',
              },
            ],
          },
        ],
      },
      {
        id: 'read',
        kind: 'phase',
        title: 'Read',
        children: [
          {
            id: 'pl',
            kind: 'pipeline',
            items: { kind: 'symbolic', sourceText: 'sources' },
            stages: [
              {
                id: 'extract',
                kind: 'agent',
                prompt: 'read the source and extract claims with citations',
                label: 'read + extract',
                hasSchema: true,
              },
            ],
          },
        ],
      },
      {
        id: 'synth',
        kind: 'phase',
        title: 'Synthesize',
        children: [
          {
            id: 'report',
            kind: 'agent',
            prompt: 'synthesize a cited report from the extracted claims',
            label: 'synthesize report',
            model: 'opus',
          },
        ],
      },
    ],
  },
};
