import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createAppServer, apiVersion } from './src/app/server.mjs';
test('resume upload, export, validation and primary page work over HTTP', async t => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await (await fetch(`${base}/api/health`)).json(); assert.equal(health.app, 'job-applier'); assert.equal(health.apiVersion, apiVersion);
  const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /Choose your resume/);
  const original = 'Asha Patel\nSoftware Engineer\nSkills: Python, SQL\nBuilt reporting applications using Python and SQL.';
  const uploaded = await fetch(`${base}/api/resume?filename=resume.txt`, { method: 'POST', body: original }); assert.equal(uploaded.status, 200); const data = await uploaded.json(); assert.equal(data.profile.name, 'Asha Patel');
  const exported = await fetch(`${base}/api/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: data.text, format: 'pdf' }) }); assert.equal(exported.status, 200); assert.equal(exported.headers.get('content-type'), 'application/pdf'); assert.equal(Buffer.from(await exported.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await fetch(`${base}/api/export`, { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await fetch(`${base}/api/resume?filename=resume.txt`, { method: 'POST', headers: { Origin: 'https://unrelated.example' }, body: original })).status, 403);
  assert.equal((await fetch(`${base}/api/jobs?board=../invalid`)).status, 400);
});
test('every frontend module and its transitive imports are served with JavaScript MIME types', async t => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const queue = ['/app.js'], seen = new Set();
  while (queue.length) {
    const path = queue.shift(); if (seen.has(path)) continue; seen.add(path);
    const response = await fetch(base + path); assert.equal(response.status, 200, path); assert.match(response.headers.get('content-type'), /javascript/, path);
    const source = await response.text();
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) if (match[1].startsWith('.')) queue.push(new URL(match[1], base + path).pathname);
  }
  assert.ok(seen.has('/src/shared/utils/pune.mjs')); assert.ok(!seen.has('/src/features/employers/constants/companies.mjs')); assert.ok(seen.has('/src/features/employers/utils/company-priority.mjs'));
});

test('AI endpoints require local JSON requests and expose no credential data', async t => {
  let analyses = 0;
  const ai = { async status() { return { ready: true, billing: 'subscription-only', message: 'Connected to ChatGPT Plus' }; }, async analyze(input) { analyses++; return { summary: input.task, billing: 'subscription-only' }; } };
  const server = createAppServer({ ai }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`, headers = { 'Content-Type': 'application/json' };
  const status = await fetch(`${base}/api/ai/status`, { method: 'POST', headers, body: '{}' });
  assert.equal(status.status, 200); assert.equal((await status.json()).billing, 'subscription-only');
  for (const extra of [{ Origin: 'https://unrelated.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Content-Type': 'text/plain' }]) {
    assert.equal((await fetch(`${base}/api/ai/analyze`, { method: 'POST', headers: { ...headers, ...extra }, body: '{"task":"profile"}' })).status, 403, JSON.stringify(extra));
  }
  const invalidHost = await new Promise((resolve, reject) => {
    const req = request(`${base}/api/ai/analyze`, { method: 'POST', headers: { ...headers, Host: 'unrelated.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end('{"task":"profile"}');
  });
  assert.equal(invalidHost, 403);
  assert.equal(analyses, 0);
  assert.equal((await fetch(`${base}/api/ai/analyze`, { method: 'POST', headers, body: '{"task":"profile"}' })).status, 200);
  assert.equal(analyses, 1);
});

test('AI search routes replace fixed discovery and failures explicitly return an empty job list', async t => {
  let searches = 0;
  const ai = { async planSearch(input) { return { plan: { summary: input.resume }, token: 'test' }; }, async searchJobs() { searches++; throw new Error('Search unavailable'); } };
  const server = createAppServer({ ai }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`, headers = { 'Content-Type': 'application/json' };
  const retired = await fetch(base + '/api/discover'); assert.equal(retired.status, 410); assert.deepEqual((await retired.json()).jobs, []);
  const profile = await fetch(base + '/api/ai/search-profile', { method: 'POST', headers, body: JSON.stringify({ resume: 'Synthetic profile' }) }); assert.equal(profile.status, 200); assert.equal((await profile.json()).token, 'test');
  const forbidden = await fetch(base + '/api/ai/search-jobs', { method: 'POST', headers: { ...headers, Origin: 'https://unrelated.example' }, body: '{}' }); assert.equal(forbidden.status, 403); assert.equal(searches, 0);
  const failure = await fetch(base + '/api/ai/search-jobs', { method: 'POST', headers, body: '{}' }); assert.equal(failure.status, 503); assert.deepEqual((await failure.json()).jobs, []); assert.equal(searches, 1);
});

test('Naukri discovery and detail require local JSON requests and validate destination URLs', async t => {
  const server = createAppServer({ naukri: async profile => ({ jobs: [], status: 'empty', profile }) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`, headers = { 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/api/naukri`, { method: 'POST', headers, body: '{}' })).status, 400);
  assert.equal((await fetch(`${base}/api/naukri/detail`, { method: 'POST', headers, body: '{"url":"https://unrelated.example"}' })).status, 400);
  const oversized = await fetch(`${base}/api/naukri/detail`, { method: 'POST', headers, body: JSON.stringify({ url: 'x'.repeat(4200) }) });
  assert.equal(oversized.status, 413); assert.match((await oversized.json()).error, /4,096 bytes/);
  for (const path of ['/api/naukri', '/api/naukri/detail']) {
    assert.equal((await fetch(base + path, { method: 'POST', headers: { ...headers, 'Sec-Fetch-Site': 'cross-site' }, body: '{}' })).status, 403);
    assert.equal((await fetch(base + path, { method: 'POST', body: '{}' })).status, 403);
  }
  const result = await (await fetch(`${base}/api/naukri`, { method: 'POST', headers, body: '{"roles":["Developer"],"skills":["C#"],"experienceYears":3.8,"email":"not-for-search@example.com"}' })).json();
  assert.equal(result.status, 'empty'); assert.equal(result.profile.email, undefined);
});

test('route methods, legacy module URLs and the static allowlist retain their contracts', async t => {
  const server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    for (const path of ['/api/health', '/api/discover', '/api/jobs', '/missing']) {
      const response = await fetch(base + path, { method });
      assert.equal(response.status, 405, `${method} ${path}`);
      await response.arrayBuffer();
    }
  }
  for (const name of ['match', 'resume', 'pune', 'companies', 'company-priority', 'discovery', 'jobs', 'naukri-page', 'naukri-capture']) {
    const response = await fetch(`${base}/${name}.mjs`);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /javascript/);
    const source = await response.text(), target = source.match(/export \* from "([^"]+)"/)[1];
    assert.equal((await fetch(base + target)).status, 200, name);
  }
  for (const path of ['/src/app/server.mjs', '/src/services/integrations/codex-ai.mjs', '/src/features/resume/services/documents.mjs', '/package.json', '/.local/search-signing-key', '/.qa/architecture-baseline/manifest.json']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.deepEqual(Buffer.from(await (await fetch(base + '/style.css')).arrayBuffer()), await readFile('src/styles/style.css'));
  assert.deepEqual(Buffer.from(await (await fetch(base)).arrayBuffer()), await readFile('index.html'));
});

test('feature routes preserve board requests, injected integrations and malformed-input errors', async t => {
  const nativeFetch = globalThis.fetch, calls = [];
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith('https://boards-api.greenhouse.io/')) {
      calls.push({ input, options });
      return Response.json({ jobs: [{ id: 17, title: 'Developer', location: { name: 'Pune' }, absolute_url: 'https://example.com/jobs/17', content: '<p>Develop software</p>' }] });
    }
    return nativeFetch(input, options);
  };
  const server = createAppServer({
    naukriDetail: async url => ({ status: 'available', job: { url, description: 'Complete description', partialDescription: false } }),
    ai: { async status() { return { ready: true }; }, async analyze(input) { return { summary: input.task }; } },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { globalThis.fetch = nativeFetch; await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`, headers = { 'Content-Type': 'application/json' };
  const board = await (await nativeFetch(base + '/api/jobs?board=example_board')).json();
  assert.equal(board.jobs[0].source, 'Greenhouse'); assert.equal(board.jobs[0].descriptionHtml, '<p>Develop software</p>');
  assert.equal(calls[0].input, 'https://boards-api.greenhouse.io/v1/boards/example_board/jobs?content=true');
  assert.equal(calls[0].options.redirect, 'error');
  const detail = await (await nativeFetch(base + '/api/naukri/detail', { method: 'POST', headers, body: '{"url":"https://www.naukri.com/job-listings-test-123"}' })).json();
  assert.equal(detail.job.partialDescription, false);
  for (const path of ['/api/ai/status', '/api/ai/analyze', '/api/ai/search-profile', '/api/ai/search-jobs', '/api/naukri', '/api/naukri/detail', '/api/export']) {
    const response = await nativeFetch(base + path, { method: 'POST', headers, body: '{' });
    assert.equal(response.status, 400, path); assert.equal((await response.json()).error, 'Invalid request data.');
  }
});
