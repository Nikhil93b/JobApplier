import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNaukri, createNaukriConnector } from './src/services/integrations/naukri/naukri.mjs';
const profile = { roles: ['Developer'], skills: ['React'], experienceYears: 3.8 };
const posting = { '@type': 'JobPosting', title: 'React Developer', url: 'https://www.naukri.com/job-listings-react-123', hiringOrganization: { name: 'Example' }, jobLocation: { address: { addressLocality: 'Pune' } }, description: '<p>React required</p>' };
const html = value => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
test('extracts nested public postings, deduplicates and rejects external application URLs', () => {
  const jobs = parseNaukri(html({ '@graph': [posting, posting, { ...posting, url: 'https://evil.example/job-listings-x' }] }));
  assert.equal(jobs.length, 1); assert.equal(jobs[0].location, 'Pune'); assert.equal(jobs[0].partialDescription, true);
  assert.equal(parseNaukri('<script type="application/ld+json">broken</script>' + html(posting)).length, 1);
});
test('connector bounds repeated requests and sends only search terms', async () => {
  let calls = 0;
  const connector = createNaukriConnector(async url => { calls++; assert.ok(!url.includes('private@example')); return new Response(html(posting), { headers: { 'Content-Type': 'text/html' } }); });
  const first = await connector({ ...profile, email: 'private@example' });
  assert.equal(first.status, 'available'); assert.equal(first.jobs.length, 1);
  assert.equal((await connector(profile)).cached, true); assert.equal(calls, 1);
});
test('blocked access and browser shells are unavailable, never successful empty results', async () => {
  for (const response of [new Response('Denied', { status: 403 }), new Response('<html>Loading</html>', { headers: { 'Content-Type': 'text/html' } })]) {
    const result = await createNaukriConnector(async () => response, async () => ({ status: 'unavailable', jobs: [], message: 'No public cards' }))(profile);
    assert.ok(['blocked', 'unavailable'].includes(result.status)); assert.equal(result.sources[0].ok, false); assert.deepEqual(result.jobs, []);
  }
});

test('transient busy results do not prevent retry when the browser becomes available', async () => {
  let calls = 0;
  const connector = createNaukriConnector(async () => new Response('<html>Loading</html>', { headers: { 'Content-Type': 'text/html' } }), async () => ++calls === 1 ? { status: 'busy', jobs: [], message: 'Busy' } : { status: 'available', jobs: [{ title: 'Role' }], message: 'Ready' });
  assert.equal((await connector(profile)).status, 'busy');
  assert.equal((await connector(profile)).status, 'available'); assert.equal(calls, 2);
});

test('a browser-rendered shell falls back to rendering and preserves explicit blocked/empty states', async () => {
  for (const status of ['blocked', 'empty', 'available']) {
    let rendered = false;
    const connector = createNaukriConnector(async () => new Response('<html>Loading</html>', { headers: { 'Content-Type': 'text/html' } }), async () => { rendered = true; return { status, jobs: status === 'available' ? [{ title: 'Fixture role' }] : [], message: status }; });
    const result = await connector(profile); assert.equal(rendered, true); assert.equal(result.status, status);
    assert.equal(result.sources[0].ok, status !== 'blocked');
  }
});
