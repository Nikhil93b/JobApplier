import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createAppServer } from './server.mjs';
import { extractProfile } from './src/features/resume/utils/resume.mjs';
import { encodeNaukriCapture } from './src/services/integrations/naukri/naukri-capture.mjs';

test('review, tailoring, tracker and capture imports preserve original facts and draft approvals across features', async t => {
  const resume = 'Example Candidate\n.NET Developer\n4 years of experience\nTechnical Skills\n.NET, SQL, Agile\nProfessional Experience\nBuilt .NET services backed by SQL.';
  const originalLine = 'Built .NET services backed by SQL.', suggestedLine = 'Developed .NET services backed by SQL.';
  const jobUrl = 'https://www.naukri.com/job-listings-controlled-developer-123';
  const description = 'Develop .NET backend services backed by SQL and REST APIs. Collaborate with the team using Agile methods. Required experience: 3-5 years.';
  let reviews = 0, detailCalls = 0;
  const ai = {
    async status() { return { ready: true, message: 'Controlled connection is ready' }; },
    async analyze(input) {
      reviews++;
      assert.equal(input.resume, resume);
      if (input.task === 'job') assert.equal(input.job.description, description);
      return { summary: 'Controlled evidence review', supportedFacts: [originalLine], gaps: [], questions: [], suggestions: [{ original: originalLine, suggested: suggestedLine, evidence: originalLine, reason: 'Same supported work' }], provider: 'Controlled', model: 'Fixture' };
    },
  };
  const server = createAppServer({ ai, naukriDetail: async url => {
    detailCalls++; assert.equal(url, jobUrl);
    return { status: 'available', job: { url, title: '.NET Developer', company: 'Controlled Employer', location: 'Baner, Pune', description, partialDescription: false } };
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const dom = new JSDOM(await readFile('index.html', 'utf8'), { url: base });
  const nativeFetch = globalThis.fetch, downloads = [], requests = [];
  const keys = ['document', 'location', 'localStorage', 'DOMParser', 'confirm', 'fetch'];
  const previous = Object.fromEntries(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const $ = id => dom.window.document.getElementById(id), event = type => new dom.window.Event(type, { bubbles: true });
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  dom.window.HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push(this.download); };
  Object.assign(globalThis, { document: dom.window.document, location: dom.window.location, localStorage: dom.window.localStorage, DOMParser: dom.window.DOMParser, confirm: () => true });
  globalThis.fetch = async (input, options) => {
    const url = new URL(input, base); requests.push(url.pathname);
    return nativeFetch(url, options);
  };
  t.after(async () => {
    for (const key of keys) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]); else delete globalThis[key]; }
    dom.window.close(); await new Promise(resolve => server.close(resolve));
  });
  const saved = () => JSON.parse(localStorage.getItem('job-applier'));
  const waitFor = async predicate => {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline) assert.fail($('message').textContent + ' / ' + $('ai-job-status').textContent);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const navigate = hash => { dom.window.history.replaceState(null, '', hash); dom.window.dispatchEvent(event('hashchange')); };
  localStorage.setItem('job-applier', JSON.stringify({ resume, filename: 'original.txt', profile: extractProfile(resume), revision: 'controlled-revision', jobs: [{ id: 'naukri-job', title: '.NET Developer', company: 'Controlled Employer', url: jobUrl, location: 'Baner, Pune', description: 'Partial listing', partialDescription: true, source: 'Naukri', selected: true }] }));
  await import('./src/app/app.js?feature-workflow');
  $('upload').disabled = false; $('upload').dispatchEvent(event('app-ready'));
  assert.equal(reviews, 0); assert.equal(detailCalls, 0);
  assert.equal($('results').querySelectorAll('.job').length, 0);
  navigate('#ai'); assert.equal($('ai').hidden, false); assert.equal($('jobs').hidden, true);
  $('ai-check').click(); await waitFor(() => $('ai-status').textContent === 'Controlled connection is ready');
  $('ai-profile').click(); await waitFor(() => /AI review ready/.test($('ai-status').textContent));
  assert.equal(reviews, 1); assert.equal(saved().resume, resume);
  navigate('#tracker'); assert.equal($('ai').hidden, true); assert.equal($('jobs').hidden, false);
  $('applications').querySelector('button').click(); await waitFor(() => $('tailor').open);
  assert.equal(detailCalls, 1); assert.equal(saved().jobs[0].description, description);
  $('approved').checked = true; $('approved').dispatchEvent(event('change')); assert.equal($('download-pdf').disabled, false);
  $('ai-job').click(); await waitFor(() => /AI review ready/.test($('ai-job-status').textContent));
  assert.equal(reviews, 2);
  $('ai-job-results').querySelector('button').click();
  assert.match($('tailored-text').value, /Developed \.NET services/);
  assert.equal(saved().resume, resume); assert.equal(saved().jobs[0].tailored.approved, false);
  assert.equal($('download-pdf').disabled, true);
  $('approved').checked = true; $('approved').dispatchEvent(event('change'));
  $('download-docx').click(); await waitFor(() => downloads.length === 1); assert.match(downloads[0], /\.docx$/);
  const status = $('applications').querySelector('select'); status.value = 'Interview'; status.dispatchEvent(event('change'));
  assert.equal(saved().jobs[0].status, 'Interview');
  $('export').click(); assert.equal(downloads.at(-1), 'job-tracker.json');
  $('close').click();

  // A changed captured JD is staged without mutation, then updates the same job and archives its reviewed draft.
  const changed = description + ' Additional requirement: review deployment processes.';
  const capture = { version: 1, pageUrl: jobUrl, capturedAt: new Date().toISOString(), jobs: [{ title: '.NET Developer', company: 'Controlled Employer', location: 'Baner, Pune', url: jobUrl, description: changed, partialDescription: false }] };
  navigate('#naukri-import=' + encodeNaukriCapture(capture));
  assert.equal(dom.window.location.hash, ''); assert.equal($('capture-preview').hidden, false);
  assert.equal(saved().jobs[0].description, description); assert.equal(saved().jobs[0].tailored.approved, true);
  $('capture-confirm').click();
  assert.equal(saved().jobs.length, 1); assert.equal(saved().jobs[0].description, changed);
  assert.equal(saved().jobs[0].tailored, undefined); assert.equal(saved().jobs[0].aiReview, undefined);
  assert.equal(saved().jobs[0].previousTailored[0].approved, true); assert.equal(saved().jobs[0].status, 'Interview');
  assert.equal(saved().resume, resume); assert.equal(saved().jobs[0].id, 'naukri-job');
  assert.ok(!requests.includes('/api/ai/search-profile') && !requests.includes('/api/ai/search-jobs'));
});
