import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { launchAppBrowser } from './src/services/integrations/browser.mjs';
import { createAppServer } from './src/app/server.mjs';

const resumePath = process.env.JOB_APPLIER_TEST_RESUME;
if (!resumePath) throw new Error('Set JOB_APPLIER_TEST_RESUME to your local Word or PDF resume.');
const output = resolve('.qa/usability-test'); await mkdir(output, { recursive: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const originalHash = digest(await readFile(resumePath));
const report = { passed: false, source: 'Controlled job and blocked-source records; no live Naukri claim. No AI requests or applications.', checks: [] };
const server = createAppServer({ naukri: async () => ({ jobs: [], status: 'blocked', message: 'Controlled source failure: HTTP 403', sources: [{ name: 'Naukri live', ok: false, count: 0 }] }) });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await launchAppBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message)); page.on('request', req => requests.push(new URL(req.url()).pathname));
const callCount = path => requests.filter(url => url === path).length;
const ready = () => page.waitForFunction(() => !document.getElementById('upload').disabled && !document.getElementById('refresh').disabled && !document.getElementById('profile-summary').hidden);
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`); await page.locator('#upload:not([disabled])').waitFor();
  assert.equal(await page.locator('#resume-submit').isDisabled(), true); assert.equal(await page.locator('#search-workspace').isVisible(), false);
  await page.screenshot({ path: resolve(output, '01-start-desktop.png') });
  await page.locator('#upload').setInputFiles(resumePath); await page.waitForTimeout(200);
  assert.equal(callCount('/api/resume'), 0); assert.equal(callCount('/api/discover'), 0); assert.equal(await page.locator('#profile-summary').isVisible(), false);
  assert.equal(await page.locator('#resume-submit').isEnabled(), true); assert.match(await page.locator('#upload-status').textContent(), /Click.*Find matching jobs/);
  await page.locator('#resume-submit').click(); await ready();
  assert.equal(callCount('/api/resume'), 1); assert.equal(callCount('/api/discover'), 1); assert.equal(callCount('/api/ai/analyze'), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'results-heading');
  const originalText = await page.evaluate(() => JSON.parse(localStorage.getItem('job-applier')).resume);
  assert.ok(await page.locator('#results .job').count() > 0);
  report.checks.push('File selection does not upload or search; explicit submit reads the actual resume and shows results', 'Focus moves to results; no AI allowance used');
  await page.locator('#jobs').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '02-results-desktop.png') });
  await page.locator('#company-priority').selectOption('mnc-only');
  assert.equal(await page.locator('#results .job').count(), 0); assert.match(await page.locator('#results').textContent(), /0 saved lead/);
  await page.locator('#results').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '03-empty-guidance.png') });
  await page.locator('#results').getByRole('button', { name: 'Show all saved jobs', exact: true }).click();
  assert.equal(await page.locator('#results .job').count(), 8); await page.locator('#reset-filters').click();
  assert.equal(await page.locator('#company-priority').inputValue(), 'mnc-first');
  await page.locator('#more-filters > summary').click(); await page.locator('#threshold').fill('50');
  assert.equal(await page.locator('#partial-filter-note').isVisible(), true); assert.equal(await page.locator('#results .job').count(), 0);
  await page.locator('#include-partial').click(); assert.ok(await page.locator('#results .job').count() > 0);
  for (const id of ['region-scope', 'company-priority', 'threshold', 'job-view', 'title-filter', 'experience-filter']) {
    const help = await page.locator('#' + id).getAttribute('aria-describedby'); assert.ok((await page.locator('#' + help).textContent()).length > 20, id);
  }
  report.checks.push('Every job filter has linked explanatory text', 'MNC-only empty state explains exclusion and Show all saved jobs restores results', 'Partial-description warning and recovery work');
  await page.locator('#open-job-guide').click(); assert.equal(await page.locator('#naukri-guide').getAttribute('open'), '');
  assert.equal(await page.locator('#naukri-searches a').count(), 6);
  await page.locator('#guide-import').click();
  await page.locator('#title').fill('.NET Developer — Guided UI QA'); await page.locator('#company').fill('Infosys');
  await page.locator('#job-location').fill('Hinjewadi Phase 2, Pune'); await page.locator('#url').fill('https://example.com/careers/guided-ui-qa');
  await page.locator('#description').fill('CONTROLLED QA RECORD, NOT A VACANCY. Develop C# and .NET applications with SQL Server, REST APIs and Azure. Work with the software team, review requirements and test applications. Location: Hinjewadi Phase 2, Pune.');
  await page.locator('#jobform').getByRole('button', { name: 'Save job & review match', exact: true }).click();
  await page.locator('#tailor[open]').waitFor(); assert.equal(await page.locator('#download-pdf').isDisabled(), true);
  await page.locator('#approved').check();
  for (const format of ['pdf', 'docx']) {
    const waiting = page.waitForEvent('download'); await page.locator('#download-' + format).click();
    const saved = resolve(output, 'reviewed-resume.' + format); await (await waiting).saveAs(saved);
    const signature = (await readFile(saved)).subarray(0, 5).toString(); assert.match(signature, format === 'pdf' ? /^%PDF-/ : /^PK/);
  }
  await page.locator('#close').click();
  await page.locator('#region-scope').selectOption('hinjewadi-2');
  assert.equal(await page.locator('#results .job').count(), 1); assert.match(await page.locator('#location-help').textContent(), /explicitly listing this phase/);
  await page.locator('#source-options > summary').click(); const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/naukri');
  await page.locator('#naukri-live').click(); await response; await page.locator('#naukri-live:not([disabled])').waitFor();
  assert.match(await page.locator('#discovery-status').textContent(), /saved jobs are still available/); assert.doesNotMatch(await page.locator('#discovery-status').textContent(), /HTTP 403/);
  assert.match(await page.locator('#source-error').textContent(), /HTTP 403/); assert.equal(await page.locator('#results .job').count(), 1);
  report.checks.push('Guided Naukri search exposes six area links and opens the manual-import form', 'Complete-job import, approval and actual PDF/Word downloads work', 'Hinjewadi Phase 2 filter works with imported MNC', 'Blocked access keeps results and offers a clear next action');
  await page.locator('#workspace-ai-nav').click(); await page.locator('#ai').waitFor();
  assert.equal(await page.locator('#jobs').isVisible(), false); assert.equal(await page.locator('#profile').isVisible(), false);
  assert.equal(await page.locator('#ai-profile').isEnabled(), true); assert.equal(callCount('/api/ai/analyze'), 0);
  await page.locator('#ai-back-to-jobs').click(); await page.locator('#jobs').waitFor();
  assert.equal(await page.locator('#region-scope').inputValue(), 'hinjewadi-2'); assert.equal(await page.locator('#job-search').count(), 0);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('job-applier'));
    saved.aiProfile = { revision: saved.revision, summary: 'Controlled saved AI review — navigation test', supportedFacts: ['Controlled example fact for UI testing.'], gaps: ['Controlled example review point.'], questions: [], suggestions: [], provider: 'QA fixture', model: 'fixture', billing: 'subscription-only' };
    localStorage.setItem('job-applier', JSON.stringify(saved));
  });
  await page.locator('#workspace-ai-nav').click(); await page.reload(); await page.locator('#ai').waitFor();
  assert.match(await page.locator('#ai-profile-results').textContent(), /Controlled saved AI review/);
  assert.match(await page.locator('#ai-resume-context').textContent(), /latest saved review/); assert.equal(callCount('/api/ai/analyze'), 0);
  assert.equal(await page.locator('#workspace-ai-nav').getAttribute('aria-current'), 'page');
  await page.screenshot({ path: resolve(output, '07-ai-review-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('#workspace-ai-nav').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, '08-ai-review-mobile.png') });
  await page.locator('#ai-back-to-jobs').click(); await page.locator('#jobs').waitFor(); await page.setViewportSize({ width: 1440, height: 1000 });
  report.checks.push('Dedicated AI screen separates the report from job search on desktop and mobile', 'View switching preserves job filters', 'Direct AI-screen reload restores a controlled saved review without starting analysis');
  const application = page.locator('#applications .job').filter({ hasText: 'Guided UI QA' }); await application.locator('select').selectOption('Interview');
  const researchBeforeReload = callCount('/api/discover'); await page.reload(); await ready();
  assert.equal(callCount('/api/discover'), researchBeforeReload); assert.equal(await page.locator('#resume-submit').isEnabled(), true);
  assert.equal(await page.locator('#applications .job').filter({ hasText: 'Guided UI QA' }).locator('select').inputValue(), 'Interview');
  await page.locator('#upload').setInputFiles({ name: 'invalid.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('not a Word document') });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('job-applier')).resume), originalText);
  await page.locator('#resume-submit').click(); await page.waitForFunction(() => !document.getElementById('upload').disabled && /not a valid Word/.test(document.getElementById('upload-status').textContent));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('job-applier')).resume), originalText);
  await page.locator('#profile').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '04-saved-resume-desktop.png') });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.locator('#profile').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Profile overflow at ${width}`);
    await page.screenshot({ path: resolve(output, `05-mobile-start-${width}.png`) });
    await page.locator('#job-controls').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Filters overflow at ${width}`);
    await page.screenshot({ path: resolve(output, `06-mobile-filters-${width}.png`) });
  }
  assert.equal(digest(await readFile(resumePath)), originalHash); assert.deepEqual(errors, []);
  report.checks.push('Reload restores resume and tracking without automatically searching', 'Bad replacement file leaves saved resume unchanged', 'Desktop and 390/320px mobile layouts fit the viewport', 'Original resume file unchanged and no browser JavaScript errors'); report.passed = true;
} catch (error) { report.failure = error.message; throw error; }
finally { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
