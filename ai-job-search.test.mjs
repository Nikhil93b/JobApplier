import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSearchProfile, validateSearchedJobs, createSearchAuthorization, publicJobUrl, loadSearchAuthorization } from './src/features/job-search/services/ai-job-search.mjs';

const resume = 'Java Developer\n4 years of experience\nSkills: Java, Spring Boot, Agile\nBuilt Spring Boot services using Agile.';
const plan = { summary: 'Java backend work', roles: [{ title: 'Java Developer', reason: 'Recent backend work', evidence: 'Built Spring Boot services' }], keywords: [{ name: 'Java', kind: 'technical', source: 'skills', evidence: 'Java' }, { name: 'Agile', kind: 'method', source: 'recent-experience', evidence: 'using Agile' }], experienceYears: 4, experienceEvidence: '4 years of experience' };
const url = 'https://example.com/jobs/java-developer-123';
const job = { role: 'Java Developer', title: 'Senior Java Developer', company: 'Example', location: 'Pune', url, description: 'Build Java services using Spring Boot.', sourceQuote: 'Build Java services', score: 90, reason: 'Relevant Java and four years', matchedKeywords: ['Java'], missingKeywords: ['Docker'], minExperience: 3, maxExperience: 5, experienceFit: 'within', postedDate: null };
const web = [{ type: 'webSearch', action: { type: 'search', query: 'Java Developer Pune' } }, { type: 'webSearch', action: { type: 'openPage', url } }];

test('AI search profile requires supported evidence and development keywords', () => {
  assert.equal(validateSearchProfile(plan, resume), plan);
  assert.throws(() => validateSearchProfile({ ...plan, roles: [{ ...plan.roles[0], evidence: 'Invented experience' }] }, resume), /exact resume evidence/);
  assert.throws(() => validateSearchProfile({ ...plan, keywords: [{ ...plan.keywords[0], name: 'Communication' }] }, resume), /technical skills/);
  assert.throws(() => validateSearchProfile({ ...plan, experienceEvidence: '20 years' }, resume), /experience must cite/);
});

test('separate ephemeral signing keys reject changed plans and unrelated tokens', () => {
  const auth = createSearchAuthorization(), token = auth.sign(plan);
  auth.verify(plan, token);
  assert.throws(() => auth.verify({ ...plan, experienceYears: 10 }, token), /no longer valid/);
  assert.throws(() => createSearchAuthorization().verify(plan, token), /no longer valid/);
});

test('real web activity and opened individual source pages are required; duplicate and unsupported jobs are excluded', () => {
  assert.throws(() => validateSearchedJobs({ summary: 'No search', jobs: [job] }, plan, []), /did not perform a web search/);
  const result = validateSearchedJobs({ summary: 'Retrieved', jobs: [job, job, { ...job, url: 'https://example.com/jobs/unopened' }] }, plan, web);
  assert.equal(result.jobs.length, 1); assert.equal(result.discarded, 2); assert.equal(result.diagnostics.proposedJobs, 3); assert.deepEqual(result.diagnostics.rejected, { duplicate: 1, source_page_not_readable: 1 }); assert.equal(result.jobs[0].source, 'Codex web search'); assert.equal(result.jobs[0].aiFit.score, 90); assert.equal(result.jobs[0].partialDescription, true);
  for (const change of [{ role: 'Accountant' }, { location: 'Mumbai' }, { minExperience: 6 }, { score: 110 }, { matchedKeywords: ['Invented skill'] }, { sourceQuote: 'Unsupported quote' }]) assert.equal(validateSearchedJobs({ summary: 'Retrieved', jobs: [{ ...job, ...change }] }, plan, web).jobs.length, 0);
  assert.equal(validateSearchedJobs({ summary: 'No supported openings', jobs: [] }, plan, web).jobs.length, 0);
  const batch = [{ ...web[0] }, { type: 'webSearch', action: { type: 'openPage', url: 'https://example.com/jobs/failed' }, results: [{ title: 'Internal Error' }, { url, title: 'Java Developer', snippet: 'Total lines: 133' }] }];
  assert.equal(validateSearchedJobs({ summary: 'Retrieved batch', jobs: [job] }, plan, batch).jobs.length, 1);
  assert.equal(validateSearchedJobs({ summary: 'Failed page', jobs: [{ ...job, url: 'https://example.com/jobs/failed' }] }, plan, batch).jobs.length, 0);
});

test('source links must be public HTTPS vacancy pages', () => {
  for (const value of ['http://example.com/jobs/123', 'https://localhost/jobs/123', 'https://192.168.1.2/jobs/123', 'https://example.com/', 'https://example.com/careers', 'https://www.naukri.com/jobs-in-pune', 'https://user:pass@example.com/jobs/123']) assert.equal(publicJobUrl(value), null, value);
  assert.equal(publicJobUrl(url + '?utm_source=tracker#apply'), url);
});


test('persisted search authorization remains valid after reloading the service', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'job-applier-auth-'));
  const beforeRestart = await loadSearchAuthorization(directory), token = beforeRestart.sign(plan);
  const afterRestart = await loadSearchAuthorization(directory);
  afterRestart.verify(plan, token);
  assert.throws(() => afterRestart.verify({ ...plan, experienceYears: 20 }, token), /no longer valid/);
});
