import test from 'node:test';
import assert from 'node:assert/strict';
import { boardToken, normalizeJobs, parseProfile, matchesPreferences } from './src/features/job-import/utils/discovery.mjs';
test('board input only permits official Greenhouse boards or bounded tokens', () => {
  assert.equal(boardToken('https://job-boards.greenhouse.io/example/jobs/123'), 'example');
  assert.equal(boardToken('https://boards.greenhouse.io/example'), 'example');
  for (const input of ['https://localhost/foo', 'https://boards.greenhouse.io.evil.com/foo', '../foo', '', 'http://boards.greenhouse.io/foo']) assert.equal(boardToken(input), null);
});
test('normalizing live jobs retains description and location and rejects invalid links', () => {
  const jobs = normalizeJobs({ jobs: [{ id: 12, title: 'Analyst', location: { name: 'Remote' }, content: '<p>SQL</p>', absolute_url: 'https://example.com/job' }, { title: 'Bad', absolute_url: 'javascript:alert(1)' }] }, 'example');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].descriptionHtml, '<p>SQL</p>'); assert.equal(jobs[0].location, 'Remote');
  assert.throws(() => normalizeJobs({}, 'example'));
});
test('profile import validates fields and leaves omitted resume unchanged', () => {
  assert.deepEqual(parseProfile('{"skills":["SQL","Python"],"roles":["Data Analyst"]}'), { extra: 'SQL, Python', role: 'Data Analyst' });
  for (const input of ['[]', '{}', '{"roles":"Analyst"}', '{"skills":[1]}']) assert.throws(() => parseProfile(input));
});
test('role and location preferences apply independently with multiple choices', () => {
  const job = { title: 'Senior Data Analyst', location: 'Remote, India' };
  assert.equal(matchesPreferences(job, 'Developer, Data Analyst', 'Remote'), true);
  assert.equal(matchesPreferences(job, 'Developer', 'Remote'), false);
  assert.equal(matchesPreferences(job, '', 'Mumbai'), false);
  assert.equal(matchesPreferences(job, '', ''), true);
});
