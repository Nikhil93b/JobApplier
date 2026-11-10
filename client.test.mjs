import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createAppServer } from './src/app/server.mjs';
import { exportResume } from './src/features/resume/services/documents.mjs';
const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
const bootstrap = html.match(/<script type="module" id="app-bootstrap">([\s\S]*?)<\/script>/)[1];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

test('startup displays a useful error instead of a dead upload control on an old server', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost:3000' });
  try {
    const run = new AsyncFunction('document', 'location', 'fetch', 'AbortSignal', bootstrap);
    await run(dom.window.document, dom.window.location, async () => new Response('Not found', { status: 404 }), AbortSignal);
    assert.match(dom.window.document.getElementById('startup-status').textContent, /server is outdated/i);
    assert.match(dom.window.document.getElementById('startup-status').textContent, /Ctrl\+C/);
    assert.equal(dom.window.document.getElementById('upload').disabled, true);
  } finally { dom.window.close(); }
});
test('startup rejects incompatible APIs before importing the client modules', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost:3000' });
  try {
    const run = new AsyncFunction('document', 'location', 'fetch', 'AbortSignal', bootstrap);
    await run(dom.window.document, dom.window.location, async () => Response.json({ app: 'job-applier', apiVersion: 1 }), AbortSignal);
    assert.match(dom.window.document.getElementById('startup-status').textContent, /versions do not match/i);
  } finally { dom.window.close(); }
});


test('AI search UI requires explicit analysis and search, clears failed runs and preserves reviewed downloads', async t => {
  let planCalls = 0, searchCalls = 0, failSearch = false, expireSearch = false, reviewCalls = 0;
  const ai = {
    async status() { return { ready: true }; },
    async planSearch({ resume }) {
      planCalls++;
      const java = resume.includes('Spring Boot');
      return { token: 'controlled-token', plan: { summary: 'Relevant recent development experience', roles: [{ title: java ? 'Java Developer' : '.NET Developer', reason: 'Recent work', evidence: java ? 'Spring Boot' : '.NET' }], keywords: [{ name: java ? 'Java' : '.NET', kind: 'technical', source: 'skills', evidence: java ? 'Java' : '.NET' }, { name: 'Agile', kind: 'method', source: 'recent-experience', evidence: 'Agile' }], experienceYears: 4, experienceEvidence: '4 years of experience' } };
    },
    async searchJobs({ plan }) {
      searchCalls++; if (expireSearch) throw Object.assign(new Error('Saved profile no longer valid'), { code: 'SEARCH_PROFILE_EXPIRED', status: 400 }); if (failSearch) throw new Error('Controlled search unavailable');
      return { jobs: [{ title: plan.roles[0].title, company: 'AI Found Employer', url: 'https://example.com/jobs/current-developer-123', location: 'Hinjewadi Phase 2, Pune', description: 'Build applications using .NET and SQL. Minimum 3 years of experience. Agile delivery.', source: 'Codex web search', partialDescription: true, aiFit: { score: 91, reason: 'Recent stack and four years align', matched: plan.keywords.map(x => x.name), missing: ['Docker'], role: plan.roles[0].title, experienceFit: 'within' } }], summary: 'One current opening', fetched: new Date().toISOString() };
    },
    async analyze({ resume }) { reviewCalls++; return { summary: 'Resume review', supportedFacts: [], gaps: [], questions: [], suggestions: [] }; }
  };
  const server = createAppServer({ ai }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, dom = new JSDOM(html, { url: base });
  const nativeFetch = globalThis.fetch, downloads = [], exports = [], requests = [];
  const keys = ['document', 'location', 'localStorage', 'DOMParser', 'confirm', 'fetch'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const $ = id => dom.window.document.getElementById(id), event = type => new dom.window.Event(type, { bubbles: true });
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  dom.window.HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push(this.download); };
  Object.assign(globalThis, { document: dom.window.document, location: dom.window.location, localStorage: dom.window.localStorage, DOMParser: dom.window.DOMParser, confirm: () => true });
  globalThis.fetch = async (input, init) => {
    const url = new URL(input, base); requests.push({ path: url.pathname, body: init?.body });
    const response = await nativeFetch(url, init);
    if (url.pathname === '/api/export' && response.ok) exports.push(Buffer.from(await response.clone().arrayBuffer()).subarray(0, 5).toString());
    return response;
  };
  t.after(async () => { for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key]; } dom.window.close(); await new Promise(resolve => server.close(resolve)); });
  const waitFor = async predicate => { const deadline = Date.now() + 10000; while (!predicate()) { if (Date.now() > deadline) assert.fail(`${$('upload-status').textContent} / ${$('discovery-status').textContent}`); await new Promise(resolve => setTimeout(resolve, 10)); } };
  // Legacy data must never become a new discovery result.
  localStorage.setItem('job-applier', JSON.stringify({ jobs: [{ id: 'legacy', title: 'Fixed research job', selected: true, source: 'Company research', url: 'https://example.com/old', description: '.NET' }], resume: '' }));
  await import(`./app.js?ai-search-test=${Date.now()}`); $('upload').disabled = false;
  assert.equal($('results').querySelectorAll('.job').length, 0); assert.equal($('company-results').querySelectorAll('h3').length, 0); assert.equal($('ai-find-jobs').disabled, true); assert.equal($('analyze-search').disabled, true);
  assert.equal($('job-search'), null);
  const resume = 'Asha Patel\nSoftware Developer\n4 years of experience\nTechnical Skills\nC#, .NET, SQL, Agile\nProfessional Experience\nBuilt .NET and SQL applications using Agile.';
  const word = await exportResume(resume, 'docx');
  const upload = async (bytes, name) => {
    Object.defineProperty($('upload'), 'files', { configurable: true, value: [new File([bytes], name)] }); $('upload').dispatchEvent(event('change'));
    const before = requests.length; assert.equal($('resume-submit').disabled, false); assert.equal(requests.length, before);
    $('resume-form').dispatchEvent(event('submit')); await waitFor(() => !$('upload').disabled);
  };
  await upload(word, 'resume.docx');
  assert.doesNotMatch($('applications').textContent, /Fixed research/); assert.equal(planCalls, 0); assert.equal(searchCalls, 0); assert.equal(reviewCalls, 0); assert.equal($('analyze-search').disabled, false); assert.equal($('ai-find-jobs').disabled, true); assert.equal($('results').querySelectorAll('.job').length, 0);
  $('analyze-search').click(); await waitFor(() => !$('ai-find-jobs').disabled);
  assert.equal(planCalls, 1); assert.equal(searchCalls, 0); assert.match($('search-profile-results').textContent, /\.NET Developer/); assert.match($('search-profile-results').textContent, /Agile/);
  $('ai-find-jobs').click(); await waitFor(() => !$('ai-find-jobs').disabled);
  assert.equal(searchCalls, 1); assert.equal($('results').querySelectorAll('.job').length, 1); assert.match($('results').textContent, /91\/100 AI fit/); assert.match($('results').textContent, /Recent stack/); assert.doesNotMatch($('results').textContent, /Fixed research/);
  assert.match($('company-results').textContent, /AI Found Employer/); assert.doesNotMatch($('company-results').textContent, /SAVI/);
  $('company-area').value = 'Baner'; $('company-area').dispatchEvent(event('input'));
  assert.match($('company-summary').textContent, /1 employers found.*0 shown/); assert.match($('company-results').textContent, /none match these employer filters/);
  [...$('company-results').querySelectorAll('button')].find(x => x.textContent === 'Show all AI-found employers').click(); assert.equal($('company-results').querySelectorAll('h3').length, 1);
  const webRequest = JSON.parse(requests.find(x => x.path === '/api/ai/search-jobs').body); assert.equal('resume' in webRequest, false);
  // Filtering uses AI score even for a partial JD, and navigation starts no AI requests.
  $('threshold').value = '95'; $('threshold').dispatchEvent(event('input')); assert.equal($('results').querySelectorAll('.job').length, 0);
  $('reset-filters').click(); assert.equal($('results').querySelectorAll('.job').length, 1);
  const calls = [planCalls, searchCalls, reviewCalls]; dom.window.history.replaceState(null, '', '#ai'); dom.window.dispatchEvent(event('hashchange')); assert.deepEqual([planCalls, searchCalls, reviewCalls], calls);
  dom.window.history.replaceState(null, '', '#jobs'); dom.window.dispatchEvent(event('hashchange'));
  // Failed refresh must hide even previously successful results and employers.
  failSearch = true; $('ai-find-jobs').click(); await waitFor(() => !$('ai-find-jobs').disabled);
  assert.equal($('results').querySelectorAll('.job').length, 0); assert.equal($('company-results').querySelectorAll('h3').length, 0); assert.match($('discovery-status').textContent, /failed.*Controlled search unavailable/);
  failSearch = false; expireSearch = true; $('search-jobs-results').click(); await waitFor(() => JSON.parse(localStorage.getItem('job-applier')).currentSearch.code === 'SEARCH_PROFILE_EXPIRED');
  assert.equal($('ai-find-jobs').disabled, true); assert.match($('results').textContent, /Analyze resume again/);
  expireSearch = false; $('analyze-search').click(); await waitFor(() => !$('ai-find-jobs').disabled);
  $('ai-find-jobs').click(); await waitFor(() => !$('ai-find-jobs').disabled);
  const job = JSON.parse(localStorage.getItem('job-applier')).jobs.find(x => x.source === 'Codex web search');
  [...$('results').querySelectorAll('button')].find(x => x.textContent === 'Select & tailor resume').click();
  assert.equal($('advanced').open, true);
  $('description').value = 'Build .NET and SQL applications, implement REST APIs and collaborate using Agile. Required professional experience is 3-5 years.';
  $('jobform').dispatchEvent(event('submit')); assert.equal($('tailor').open, true); assert.equal($('download-pdf').disabled, true);
  $('approved').checked = true; $('approved').dispatchEvent(event('change'));
  $('download-pdf').click(); await waitFor(() => downloads.length === 1); assert.match(exports[0], /^%PDF-/);
  $('download-docx').click(); await waitFor(() => downloads.length === 2); assert.match(exports[1], /^PK/);
  $('tailored-text').value += '\nReviewed change'; $('tailored-text').dispatchEvent(event('input')); assert.equal($('download-pdf').disabled, true); $('tailor').close();
  await upload('invalid word', 'bad.docx'); assert.equal($('file-name').textContent, 'resume.docx'); assert.equal($('results').querySelectorAll('.job').length, 1);
  await upload('Java Candidate\nJava Developer\n4 years of experience\nSkills\nJava, Spring Boot, Agile\nExperience\nBuilt Java services using Spring Boot and Agile.', 'java.txt');
  assert.equal($('results').querySelectorAll('.job').length, 0); assert.equal($('ai-find-jobs').disabled, true);
  $('analyze-search').click(); await waitFor(() => !$('ai-find-jobs').disabled); assert.match($('search-profile-results').textContent, /Java Developer/);
  assert.ok(!requests.some(x => x.path === '/api/discover' || x.path === '/api/naukri'));
});
