import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { launchAppBrowser } from './src/services/integrations/browser.mjs';
import { createAppServer } from './src/app/server.mjs';
import { createNaukriBrowser } from './src/services/integrations/naukri/naukri-browser.mjs';
import { createNaukriConnector } from './src/services/integrations/naukri/naukri.mjs';
import { readResume } from './src/features/resume/services/documents.mjs';

const resumePath = process.env.JOB_APPLIER_TEST_RESUME;
if (!resumePath) throw new Error('Set JOB_APPLIER_TEST_RESUME to the local resume file to test.');
const liveAI = process.argv.includes('--live-ai');
const output = resolve('.qa', 'browser-test'); await mkdir(output, { recursive: true });
const originalBytes = await readFile(resumePath), digest = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { resumeFile: resumePath.split(/[\\/]/).at(-1), liveAI, workflowPassed: false, liveNaukriPassed: false, checks: [], liveNaukri: null, fixtureNaukri: null, errors: [] };
const browser = await launchAppBrowser();
const jd = 'QA FIXTURE ONLY — NOT A REAL VACANCY. We seek a Software Developer with 3–5 years of experience in C#, .NET, Angular, SQL and REST APIs. Build and test web applications, work with the team, and improve software reliability. This test role is based in Baner, Pune. AWS and Azure exposure are useful. Review the exact requirements and use only documented candidate experience.';
const cardHtml = '<!doctype html><title>QA Naukri search fixture</title><main id="jobs"></main><script>setTimeout(() => { document.getElementById("jobs").innerHTML = `<article class="srp-jobtuple-wrapper"><a class="title" href="https://www.naukri.com/job-listings-qa-browser-fixture-123456">.NET Software Developer</a><a class="comp-name">QA Browser Fixture Employer</a><span class="locWdth">Baner, Pune</span><span class="expwdth">3-5 Yrs</span><p class="job-desc">Fixture summary; fetch the full description before tailoring.</p><ul class="tags-gt"><li>C# .NET Angular SQL</li></ul></article>`; }, 100)</script>';
const detailHtml = `<!doctype html><title>QA job fixture</title><h1>.NET Software Developer</h1><p class="company-name">QA Browser Fixture Employer</p><p class="location">Baner, Pune</p><h2>Job description</h2><div id="job-description">${jd}</div><footer>Footer content is excluded from the JD.</footer>`;
const fakeAI = { async status() { return { ready: true, message: 'Fixture AI — no allowance used' }; }, async analyze(input) {
  const original = input.resume.split('\n').map(x => x.trim()).find(x => x.length > 45 && !/@/.test(x));
  return { summary: 'Controlled AI fixture', supportedFacts: [], gaps: [], questions: [], suggestions: [{ original, evidence: original, suggested: original + ' ', reason: 'Test an individually reviewed wording change.' }], provider: 'Test fixture', model: 'fixture', billing: 'subscription-only' };
} };
const fixtureRenderer = createNaukriBrowser(async () => {
  const real = await launchAppBrowser();
  return { close: () => real.close(), async newContext(options) {
    const context = await real.newContext(options), newPage = context.newPage.bind(context);
    context.newPage = async () => {
      const page = await newPage();
      await page.route('https://www.naukri.com/**', route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: new URL(route.request().url()).pathname.startsWith('/job-listings-') ? detailHtml : cardHtml }));
      return page;
    };
    return context;
  } };
});
async function start(options) {
  const server = createAppServer(options); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  const base = `http://127.0.0.1:${server.address().port}`;
  await page.goto(base); await page.locator('#upload:not([disabled])').waitFor();
  await page.locator('#upload').setInputFiles(resumePath);
  await page.locator('#resume-submit').click();
  await page.locator('#profile-summary').waitFor();
  await page.waitForFunction(() => document.getElementById('discovery-status').textContent.startsWith('Loaded 8 researched leads'));
  return { page, base, async close() { await context.close(); await new Promise(resolve => server.close(resolve)); } };
}
async function clickResponse(page, selector, path, timeout = 70000) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === path, { timeout });
  await page.locator(selector).click(); const result = await response;
  const data = await result.json(); assert.equal(result.status(), 200, data.error || path); return data;
}
try {
  const live = await start(liveAI ? {} : { ai: fakeAI });
  try {
    const { page } = live;
    assert.equal(await page.locator('#naukri-searches a').count(), 6); assert.ok(await page.locator('#skills .chip').count() > 5);
    assert.ok(await page.locator('#profile-sections details').count() > 0); report.checks.push('Real resume upload, extraction, profile sections and prepared searches');
    await page.locator('#job-search').fill('no-such-job-qa-123'); assert.equal(await page.locator('#results .job').count(), 0);
    await page.locator('#job-search').fill(''); assert.ok(await page.locator('#results .job').count() > 0);
    await page.locator('#company-directory > summary').click();
    await page.locator('#company-search').fill('no-such-company-qa-123'); assert.equal(await page.locator('#company-results .company-card').count(), 0);
    await page.locator('#company-search').fill(''); assert.ok(await page.locator('#company-results .company-card').count() > 0);
    report.checks.push('Job and company filtering');
    const countBefore = await page.locator('#results .job').count();
    await page.locator('#source-options > summary').click();
    const discovery = await clickResponse(page, '#naukri-live', '/api/naukri');
    report.liveNaukri = { status: discovery.status, count: discovery.jobs.length, message: discovery.message };
    report.liveNaukriPassed = discovery.status === 'available' && discovery.jobs.length > 0;
    if (discovery.status !== 'available') assert.equal(await page.locator('#results .job').count(), countBefore);
    report.checks.push('Live Naukri request and preservation of saved jobs on source failure');
    await page.locator('#workspace-ai-nav').click(); await page.locator('#ai').waitFor();
    const status = await clickResponse(page, '#ai-check', '/api/ai/status');
    assert.equal(status.ready, true, status.message);
    if (liveAI) {
      const ai = await clickResponse(page, '#ai-profile', '/api/ai/analyze', 150000);
      assert.equal(ai.billing, 'subscription-only'); await page.locator('#ai-profile-results p').first().waitFor();
      report.checks.push('Live ChatGPT Plus resume analysis');
    }
    await page.locator('#ai-back-to-jobs').click(); await page.locator('#profile').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, 'desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Mobile page must not overflow horizontally');
    await page.screenshot({ path: resolve(output, 'mobile.png') }); report.checks.push('Desktop and mobile layout without horizontal overflow');
  } finally { await live.close(); }

  const fixture = await start({ ...(liveAI ? {} : { ai: fakeAI }), naukri: createNaukriConnector(async () => new Response('<html>Loading</html>', { headers: { 'Content-Type': 'text/html' } }), fixtureRenderer), naukriDetail: url => fixtureRenderer(url, { detail: true }) });
  try {
    const { page } = fixture;
    await page.locator('#source-options > summary').click();
    const discovery = await clickResponse(page, '#naukri-live', '/api/naukri');
    assert.equal(discovery.status, 'available'); assert.equal(discovery.jobs.length, 1); report.fixtureNaukri = { renderedCards: 1, source: 'controlled browser fixture; not live vacancies' };
    await page.locator('#job-search').fill('QA Browser Fixture Employer');
    assert.equal(await page.locator('#results .job').count(), 1);
    const details = page.waitForResponse(r => new URL(r.url()).pathname === '/api/naukri/detail');
    await page.locator('#results').getByRole('button', { name: 'Select & tailor resume', exact: true }).click();
    const fullJD = await (await details).json(); assert.equal(fullJD.job.description, jd);
    await page.locator('#tailor[open]').waitFor(); assert.equal(await page.locator('#download-pdf').isDisabled(), true);
    report.checks.push('Browser-rendered fixture cards, automatic full-JD retrieval and tailoring');
    await page.locator('#approved').check(); assert.equal(await page.locator('#download-pdf').isDisabled(), false);
    const originalDraft = await page.locator('#tailored-text').inputValue();
    const analysis = await clickResponse(page, '#ai-job', '/api/ai/analyze', 150000);
    await page.locator('#ai-job-results p').first().waitFor(); assert.equal(await page.locator('#tailored-text').inputValue(), originalDraft);
    assert.equal(await page.locator('#approved').isChecked(), true);
    let applied = false;
    for (let i = 0; i < analysis.suggestions.length; i++) {
      const original = analysis.suggestions[i].original;
      if (originalDraft.split(original).length !== 2) continue;
      await page.locator('#ai-job-results .job').nth(i).getByRole('button').click(); applied = true; break;
    }
    if (!applied) await page.locator('#tailored-text').fill(originalDraft + '\n');
    assert.equal(await page.locator('#approved').isChecked(), false); assert.equal(await page.locator('#download-pdf').isDisabled(), true);
    report.checks.push(liveAI ? 'Live ChatGPT Plus job-fit review and approval invalidation after edits' : 'Controlled AI review and approval invalidation after edits');
    await page.locator('#approved').check();
    for (const format of ['pdf', 'docx']) {
      const download = page.waitForEvent('download'); await page.locator('#download-' + format).click();
      const path = resolve(output, `qa-tailored.${format}`); await (await download).saveAs(path);
      const text = await readResume(await readFile(path), `resume.${format}`); assert.ok(text.length > 500);
      assert.ok(text.toLowerCase().includes('nikhil'), 'Export retains the resume name');
    }
    report.checks.push('Reviewed PDF and Word downloads, file signatures and readable text');
    await page.locator('#close').click();
    const application = page.locator('#applications .job').filter({ hasText: 'QA Browser Fixture Employer' });
    await application.locator('select').selectOption('Interview');
    const trackerDownload = page.waitForEvent('download'); await page.locator('#export').click();
    const trackerPath = resolve(output, 'qa-job-tracker.json'); await (await trackerDownload).saveAs(trackerPath);
    assert.equal(JSON.parse(await readFile(trackerPath, 'utf8')).find(x => x.company === 'QA Browser Fixture Employer').status, 'Interview');
    await page.reload(); await page.locator('#profile-summary').waitFor();
    assert.equal(await page.locator('#applications .job').filter({ hasText: 'QA Browser Fixture Employer' }).locator('select').inputValue(), 'Interview');
    report.checks.push('Shortlist tracking, export and saved state after reload');
    await page.locator('#upload').setInputFiles({ name: 'bad-resume.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('not a Word file') });
    await page.locator('#resume-submit').click();
    await page.waitForFunction(() => /not a valid Word/.test(document.getElementById('upload-status').textContent));
    assert.equal(await page.locator('#profile-summary').isVisible(), true); report.checks.push('Invalid-upload recovery preserves the original profile');
  } finally { await fixture.close(); }
  assert.equal(digest(await readFile(resumePath)), digest(originalBytes)); report.checks.push('Original resume file remains unchanged');
  assert.deepEqual(report.errors, [], 'Browser runtime errors'); report.workflowPassed = true; report.overallStatus = report.liveNaukriPassed ? 'passed' : 'partial-live-source-unavailable';
} catch (error) { report.workflowPassed = false; report.overallStatus = 'failed'; report.failure = error.message; throw error; }
finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report)); await browser.close();
}
