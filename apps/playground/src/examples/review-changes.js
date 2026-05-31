export const meta = {
  name: 'review-changes',
  description: 'Review changed files across dimensions, then adversarially verify each finding.',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
};

const DIMENSIONS = [
  { key: 'bugs', prompt: 'review the diff for correctness bugs' },
  { key: 'perf', prompt: 'review the diff for performance issues' },
  { key: 'style', prompt: 'review the diff for style and clarity' },
];

phase('Review');
const reviews = await pipeline(DIMENSIONS, (dimension) =>
  agent('review the diff for this dimension', { label: 'review', schema: FINDINGS }),
);

phase('Verify');
const verified = await pipeline(reviews, (finding) =>
  parallel([
    () => agent('try to refute this finding (correctness lens)', { label: 'refute' }),
    () => agent('try to refute this finding (security lens)', { label: 'refute' }),
  ]),
);
