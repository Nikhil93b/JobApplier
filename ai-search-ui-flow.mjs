import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { launchAppBrowser } from './src/services/integrations/browser.mjs';
import { createAppServer } from './src/app/server.mjs';
import { exportResume } from './src/features/resume/services/documents.mjs';

const output = resolve('.qa/ai-search-ui'); await mkdir(output, { recursive: true });
const resumePath = process.env.JOB_APPLIER_TEST_RESUME || resolve(output, 'synthetic-resume.docx');
if (!process.env.JOB_APPLIER_TEST_RESUME) await writeFile(resumePath, await exportResume('Example Candidate\n.NET Developer\n4 years of experience\nTechnical Skills\nC#, .NET, SQL, Agile, Scrum\nProfessional Experience\nBuilt .NET services backed by SQL using Agile and Scrum.', 'docx'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex'), originalHash = digest(await readFile(resumePath));
let failSearch = false, searches = 0, plans = 0;
const ai = {
  async planSearch({ resume }) { plans++; return { token: 'controlled-test-token', plan: { summary: 'Recent backend experience supports these roles.', roles: [{ title: '.NET Developer', reason: 'Recent services work and technical skills.', evidence: resume.slice(0, 60) }], keywords: [{ name: '.NET', kind: 'technical', source: 'skills', evidence: '.NET' }, { name: 'Agile', kind: 'method', source: 'recent-experience', evidence: 'Agile' }], experienceYears: 4, experienceEvidence: '4 years of experience' } }; },
  async searchJobs() {
    searches++; if (failSearch) throw new Error('Controlled live-search failure');
    return { summary: 'Two controlled vacancies for browser testing.', fetched: new Date().toISOString(), jobs: [
      { title: '.NET Developer', company: 'Controlled Pune Employer', location: 'Baner, Pune', url: 'https://example.com/jobs/dotnet-baner-123', source: 'Codex web search', description: 'Develop .NET services using SQL and Agile.', partialDescription: true, aiFit: { score: 78, reason: 'Stack overlap; check missing Docker requirement.', matched: ['.NET', 'Agile'], missing: ['Docker'], role: '.NET Developer', experienceFit: 'within' } },
      { title: '.NET Backend Developer', company: 'Controlled Pune Employer', location: 'Pune', url: 'https://example.com/jobs/dotnet-pune-456', source: 'Codex web search', description: 'Develop .NET services using SQL and Agile.', partialDescription: true, aiFit: { score: 94, reason: 'Strong recent backend and experience alignment.', matched: ['.NET', 'Agile'], missing: [], role: '.NET Developer', experienceFit: 'within' } },
    ].reverse() };
  },
  async status() { return { ready: true, message: 'Controlled connection' }; },
};
const report = { passed: false, source: 'Controlled AI responses. No live inference, applications or resume submission to job boards.', checks: [] };
const server = createAppServer({ ai }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await launchAppBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message)); page.on('request', req => requests.push(new URL(req.url()).pathname));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`); await page.locator('#upload:not([disabled])').waitFor();
  assert.equal(await page.locator('#ai-find-jobs').isDisabled(), true); assert.equal(await page.locator('#results .job').count(), 0); assert.equal(await page.locator('#company-results h3').count(), 0);
  await page.screenshot({ path: resolve(output, '01-start.png'), fullPage: true });
  await page.locator('#upload').setInputFiles(resumePath); assert.equal(plans, 0); assert.equal(searches, 0);
  await page.locator('#resume-submit').click(); await page.waitForFunction(() => /Resume saved/.test(document.getElementById('upload-status').textContent));
  assert.equal(plans, 0); assert.equal(searches, 0); assert.equal(await page.locator('#results .job').count(), 0);
  await page.locator('#analyze-search').click(); await page.locator('#ai-find-jobs:not([disabled])').waitFor();
  assert.equal(plans, 1); assert.equal(searches, 0); assert.match(await page.locator('#search-profile-results').textContent(), /Agile/);
  await page.locator('#ai-find-jobs').click(); await page.locator('#ai-find-jobs:not([disabled])').waitFor();
  assert.equal(searches, 1); assert.equal(await page.locator('#results .job').count(), 2);
  assert.match(await page.locator('#results .job').first().textContent(), /94\/100 AI fit/);
  assert.match(await page.locator('#company-results').textContent(), /Controlled Pune Employer/);
  await page.locator('#company-directory > summary').click(); await page.locator('#company-area').selectOption('Balewadi');
  assert.match(await page.locator('#company-summary').textContent(), /1 employers found.*0 shown/); await page.getByRole('button', { name: 'Show all AI-found employers' }).click(); assert.equal(await page.locator('#company-results h3').count(), 1);
  await page.locator('#company-area').selectOption('Baner'); assert.equal(await page.locator('#company-results h3').count(), 1); assert.match(await page.locator('#company-results').textContent(), /Baner/); await page.locator('#company-area').selectOption('all');
  await page.locator('#jobs').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '02-ai-results.png'), fullPage: true });
  await page.locator('#more-filters > summary').click(); await page.locator('#threshold').fill('90'); assert.equal(await page.locator('#results .job').count(), 1); await page.locator('#reset-filters').click();
  const first = page.locator('#results .job').first(); await first.getByRole('button', { name: 'Select & tailor resume' }).click();
  await page.locator('#description').fill('Develop .NET backend services and REST APIs backed by SQL. Work with Agile delivery methods and collaborate on code reviews. Required experience: 3-5 years.');
  await page.locator('#jobform button[type=submit]').click(); await page.locator('#tailor').waitFor(); await page.locator('#approved').check();
  for (const format of ['pdf', 'docx']) {
    const waiting = page.waitForEvent('download'); await page.locator('#download-' + format).click();
    const saved = resolve(output, 'reviewed-resume.' + format); await (await waiting).saveAs(saved);
    assert.match((await readFile(saved)).subarray(0, 5).toString(), format === 'pdf' ? /^%PDF-/ : /^PK/);
  }
  await page.locator('#close').click();
  const calls = [plans, searches]; await page.locator('#workspace-ai-nav').click(); await page.locator('#jobs').waitFor({ state: 'hidden' }); await page.locator('#ai-back-to-jobs').click(); await page.locator('#jobs').waitFor({ state: 'visible' }); assert.deepEqual([plans, searches], calls);
  failSearch = true; await page.locator('#ai-find-jobs').click(); await page.locator('#ai-find-jobs:not([disabled])').waitFor();
  assert.match(await page.locator('#discovery-status').textContent(), /failed.*Controlled live-search failure/); assert.equal(await page.locator('#results .job').count(), 0); assert.equal(await page.locator('#company-results h3').count(), 0);
  await page.locator('#jobs').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '03-failed-empty.png') });
  const failedCalls = [plans, searches]; await page.reload(); await page.locator('#upload:not([disabled])').waitFor();
  assert.match(await page.locator('#discovery-status').textContent(), /failed.*Controlled live-search failure/); assert.deepEqual([plans, searches], failedCalls);
  failSearch = false; await page.locator('#search-jobs-results').click(); await page.locator('#ai-find-jobs:not([disabled])').waitFor();
  const beforeReload = [plans, searches]; await page.reload(); await page.locator('#upload:not([disabled])').waitFor(); assert.equal(await page.locator('#results .job').count(), 2); assert.deepEqual([plans, searches], beforeReload);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.locator('#profile').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Profile overflow ${width}`);
    await page.screenshot({ path: resolve(output, `04-mobile-profile-${width}.png`), fullPage: true });
    await page.locator('#job-controls').scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Results overflow ${width}`);
  }
  assert.equal(digest(await readFile(resumePath)), originalHash); assert.deepEqual(errors, []);
  assert.equal(requests.includes('/api/discover'), false); assert.equal(requests.includes('/api/naukri'), false); assert.equal(requests.includes('/api/ai/analyze'), false);
  report.checks.push('No initial/default jobs or companies', 'Upload, analysis and search are three explicit actions', 'AI roles/keywords and scores displayed', 'AI score outranks the prior locality boost', 'Score filtering and source-only employers', 'Real reviewed PDF/Word downloads', 'Navigation/reload trigger no inference', 'Failed searches clear jobs and companies', '390/320px layouts have no overflow', 'Original resume unchanged and no JS errors', 'Employer totals and filters include multiple locations for one employer', 'Failed-search status survives page reload'); report.passed = true;
} catch (error) { report.failure = error.message; throw error; }
finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
