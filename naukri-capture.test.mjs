import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeNaukriCapture, validateNaukriCapture, encodeNaukriCapture, decodeNaukriCapture } from './src/services/integrations/naukri/naukri-capture.mjs';
const url = 'https://www.naukri.com/job-listings-test-123';
const snapshot = { title: 'Naukri jobs', body: 'Job results', cards: [{ url, title: 'Développeur C#', company: 'Employer', location: 'Pune', overview: 'SQL and .NET' }] };
test('browser capture transfers only validated job fields and preserves Unicode', () => {
  const capture = makeNaukriCapture(snapshot, 'https://www.naukri.com/jobs-in-pune?k=skills#tracking');
  assert.equal(capture.jobs[0].partialDescription, true); assert.equal(capture.pageUrl, 'https://www.naukri.com/jobs-in-pune');
  capture.jobs[0].tailored = { approved: true }; capture.jobs[0].email = 'not-for-import@example.com';
  const restored = decodeNaukriCapture(encodeNaukriCapture(capture));
  assert.equal(restored.jobs[0].title, snapshot.cards[0].title); assert.equal(restored.jobs[0].tailored, undefined); assert.equal(restored.jobs[0].email, undefined);
});
test('full JD capture requires its own job page, exact URL and complete text', () => {
  const detail = makeNaukriCapture({ ...snapshot, heading: 'Developer', company: 'Employer', location: 'Pune', description: 'Build and test C# applications with SQL, documented requirements and collaboration with other developers.'.repeat(2) }, url);
  assert.equal(detail.jobs[0].partialDescription, false);
  assert.throws(() => validateNaukriCapture({ ...detail, pageUrl: 'https://www.naukri.com/jobs-in-pune' }));
  assert.throws(() => makeNaukriCapture({ ...snapshot, title: 'Access Denied', body: 'Access Denied' }, url));
});
test('capture rejects hostile destinations, malformed types, empty data and excessive input', () => {
  const capture = makeNaukriCapture(snapshot, 'https://www.naukri.com/jobs-in-pune');
  for (const value of [null, {}, { ...capture, pageUrl: 'https://unrelated.example' }, { ...capture, jobs: [] }, { ...capture, jobs: [{ ...capture.jobs[0], url: 'javascript:alert(1)' }] }, { ...capture, jobs: [{ ...capture.jobs[0], description: 'x'.repeat(40001) }] }]) assert.throws(() => validateNaukriCapture(value));
  assert.throws(() => decodeNaukriCapture('invalid@@')); assert.throws(() => decodeNaukriCapture('x'.repeat(800001)));
});
test('browser helper permissions stay limited and generated parsers match reviewed source', async () => {
  const manifest = JSON.parse(await readFile('browser-helper/manifest.json', 'utf8'));
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting']); assert.equal(manifest.host_permissions, undefined); assert.equal(manifest.background, undefined);
  for (const name of ['naukri-page.mjs', 'naukri-capture.mjs']) assert.equal(await readFile('browser-helper/' + name, 'utf8'), await readFile('src/services/integrations/naukri/' + name, 'utf8'));
});
