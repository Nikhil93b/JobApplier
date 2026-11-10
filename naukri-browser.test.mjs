import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { naukriJobUrl, naukriSnapshot, normalizeNaukriCards, naukriPageState, createNaukriBrowser } from './src/services/integrations/naukri/naukri-browser.mjs';

test('Naukri URLs cannot target arbitrary hosts, credentials or other endpoints', () => {
  for (const value of ['http://www.naukri.com/job-listings-test', 'https://evil.example/job-listings-test', 'https://www.naukri.com.evil.example/job-listings-test', 'https://user:pass@www.naukri.com/job-listings-test', 'https://www.naukri.com:444/job-listings-test', 'https://www.naukri.com/api/jobs', 'https://127.0.0.1/job-listings-test']) assert.equal(naukriJobUrl(value), null);
  assert.equal(naukriJobUrl('https://naukri.com/job-listings-test-123?src=search#x'), 'https://www.naukri.com/job-listings-test-123');
});

test('rendered public cards retain company, location, experience and partial-description provenance', () => {
  const dom = new JSDOM('<article class="srp-jobtuple-wrapper"><a class="title" href="https://www.naukri.com/job-listings-test-123">Software Developer</a><a class="comp-name">Fixture Employer</a><span class="locWdth">Baner, Pune</span><span class="expwdth">3-5 Yrs</span><p class="job-desc">Build .NET services</p><ul class="tags-gt"><li>C#</li><li>SQL</li></ul></article>', { runScripts: 'outside-only' });
  try {
    const snapshot = dom.window.eval(`(${naukriSnapshot.toString()})()`);
    const jobs = normalizeNaukriCards([...snapshot.cards, ...snapshot.cards]);
    assert.equal(jobs.length, 1); assert.equal(jobs[0].company, 'Fixture Employer'); assert.equal(jobs[0].location, 'Baner, Pune');
    assert.equal(jobs[0].minExperience, 3); assert.equal(jobs[0].maxExperience, 5); assert.equal(jobs[0].partialDescription, true);
  } finally { dom.window.close(); }
});

test('full-description extraction stays inside the JD section and detects expired/blocked pages', () => {
  const description = 'Build applications with C#, .NET, React and SQL. Collaborate with teams and deliver tested, reliable software for internal business workflows.';
  const dom = new JSDOM(`<h1>Software Developer</h1><h2>Job description</h2><div>${description}</div><footer>Unrelated footer and employer marketing</footer>`, { runScripts: 'outside-only' });
  try { assert.equal(dom.window.eval(`(${naukriSnapshot.toString()})()`).description, description); } finally { dom.window.close(); }
  const page = { title: '', body: '' };
  assert.equal(naukriPageState(403, page), 'blocked'); assert.equal(naukriPageState(200, { ...page, title: 'Access Denied' }), 'blocked');
  assert.equal(naukriPageState(200, { ...page, body: 'This job has expired.' }, true), 'expired');
  assert.equal(naukriPageState(200, { ...page, body: 'No jobs found' }), 'empty');
});

test('blocked browser requests close resources and never return job records', async () => {
  let contextClosed = false, browserClosed = false;
  const snapshot = { title: 'Access Denied', body: 'Access Denied', cards: [] };
  const collect = createNaukriBrowser(async () => ({ close: async () => { browserClosed = true; }, newContext: async () => ({ close: async () => { contextClosed = true; }, route: async () => {}, newPage: async () => ({ goto: async () => ({ status: () => 403 }), evaluate: async () => snapshot }) }) }));
  const result = await collect('https://www.naukri.com/jobs-in-pune');
  assert.equal(result.status, 'blocked'); assert.equal(result.jobs, undefined); assert.equal(contextClosed, true); assert.equal(browserClosed, true);
  await assert.rejects(collect('https://unrelated.example/jobs-in-pune'));
});

test('legitimate descriptions mentioning security checks are not challenge pages', () => {
  assert.equal(naukriPageState(200, { title: 'Software Developer', body: 'Job description: Implement security checks in C# applications.' }, true), 'ready');
  assert.equal(naukriPageState(200, { title: 'Security check', body: 'Please verify your browser.' }), 'blocked');
  assert.equal(naukriPageState(429, { title: '', body: '' }), 'blocked');
});

test('malformed external records are skipped while valid Unicode records survive', () => {
  const valid = { url: 'https://www.naukri.com/job-listings-test-123', title: 'Développeur C#', company: 'Employer', overview: 'SQL', location: 'Pune' };
  const jobs = normalizeNaukriCards([null, {}, { ...valid, title: 42 }, { ...valid, company: [] }, valid]);
  assert.equal(jobs.length, 1); assert.equal(jobs[0].title, valid.title);
});
