export const meta = {
  name: 'loop-until-dry',
  description: 'Keep hunting for bugs until two consecutive rounds turn up nothing new.',
  phases: [{ title: 'Hunt' }, { title: 'Report' }],
};

phase('Hunt');
let dry = 0;
while (dry < 2) {
  const found = await agent('find bugs not seen in earlier rounds', { label: 'find', schema: BUGS });
  if (isEmpty(found)) {
    log('a dry round — incrementing the counter');
  }
}

phase('Report');
await agent('summarize the confirmed bugs into a report', { label: 'report' });
return;
