export const meta = {
  name: 'deep-research',
  description: 'Fan out searches, read each source, then synthesize a cited report.',
  phases: [{ title: 'Sweep' }, { title: 'Read' }, { title: 'Synthesize' }],
};

phase('Sweep');
const sources = await parallel([
  () =>
    agent('search the web for relevant sources', {
      label: 'web search',
      agentType: 'Explore',
      model: 'opus',
    }),
  () => agent('search arXiv for relevant papers', { label: 'arxiv search', agentType: 'Explore' }),
]);

phase('Read');
const claims = await pipeline(sources, (source) =>
  agent('read the source and extract claims with citations', {
    label: 'read + extract',
    schema: CLAIMS,
  }),
);

phase('Synthesize');
await agent('synthesize a cited report from the extracted claims', {
  label: 'synthesize report',
  model: 'opus',
});
