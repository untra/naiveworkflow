// Preset Claude workflow scripts, bundled as raw source text (Vite `?raw`). The
// playground feeds each through `compile()` at runtime — they are never executed.
import deepResearch from './deep-research.js?raw';
import loopUntilDry from './loop-until-dry.js?raw';
import reviewChanges from './review-changes.js?raw';

export interface Example {
  id: string;
  name: string;
  source: string;
}

export const examples: Example[] = [
  { id: 'deep-research', name: 'Deep research', source: deepResearch },
  { id: 'review-changes', name: 'Review changes', source: reviewChanges },
  { id: 'loop-until-dry', name: 'Loop until dry', source: loopUntilDry },
];
