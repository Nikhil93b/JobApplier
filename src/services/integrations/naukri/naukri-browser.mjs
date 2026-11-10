import { launchAppBrowser } from '../browser.mjs';

import { naukriJobUrl, naukriSnapshot, normalizeNaukriCards, naukriPageState } from './naukri-page.mjs';
export { naukriJobUrl, naukriSnapshot, normalizeNaukriCards, naukriPageState } from './naukri-page.mjs';

export function createNaukriBrowser(launch = launchAppBrowser) {
  let busy = false;
  return async (url, { detail = false } = {}) => {
    const target = new URL(url);
    if (target.origin !== 'https://www.naukri.com' || (detail ? !naukriJobUrl(url) : target.pathname !== '/jobs-in-pune')) throw new Error('Use an official Naukri search or job link.');
    if (busy) return { status: 'busy', message: 'A Naukri browser request is already running. Wait for it to finish.' };
    busy = true; let browser, context;
    try {
      browser = await launch(); context = await browser.newContext({ acceptDownloads: false, viewport: { width: 1440, height: 1000 } });
      // Only public Naukri pages can become the main document. No existing user profile or cookies.
      await context.route('**/*', route => {
        const request = route.request();
        if (request.isNavigationRequest() && !['www.naukri.com', 'naukri.com'].includes(new URL(request.url()).hostname)) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      let snapshot = await page.evaluate(naukriSnapshot);
      let status = naukriPageState(response?.status() || 0, snapshot, detail);
      if (status === 'ready' && !(detail && snapshot.description.length >= 80)) {
        await page.waitForFunction(isDetail => isDetail
          ? [...document.querySelectorAll('h2,h3')].some(node => /^job description$/i.test(node.textContent.trim())) || document.querySelector('[itemprop="description"], [class*="dang-inner-html"], .jd-desc, .job-description, #job-description')
          : document.querySelector('a[href*="/job-listings-"]') || /no (jobs|results) found|access denied|captcha/i.test(document.body.innerText), detail, { timeout: 15000 }).catch(() => {});
        snapshot = await page.evaluate(naukriSnapshot); status = naukriPageState(response?.status() || 0, snapshot, detail);
      }
      if (status === 'blocked') return { status, message: 'Naukri blocked automated access (HTTP ' + (response?.status() || 'challenge') + '). Open the search on Naukri and import a selected description. Saved jobs are unchanged.' };
      if (status === 'expired') return { status, message: 'Naukri reports this job expired or removed. Choose another opening.' };
      if (status === 'empty') return { status, jobs: [], message: 'Naukri reports no jobs for this search. Try different roles or skills.' };
      if (status !== 'ready') return { status: 'unavailable', message: `Naukri returned HTTP ${response?.status() || 'unknown'}. Try again later.` };
      if (detail) {
        if (!naukriJobUrl(page.url())) return { status: 'unavailable', message: 'Naukri redirected away from the job description. Import its complete text manually.' };
        if (snapshot.description.length < 80) return { status: 'unavailable', message: 'Naukri did not expose a complete job description. Paste the full description to continue.' };
        return { status: 'available', job: { url: naukriJobUrl(page.url()), title: snapshot.heading, company: snapshot.company, location: snapshot.location, description: snapshot.description, partialDescription: false, source: 'Naukri', checkedAt: new Date().toISOString().slice(0, 10), evidenceLevel: 'Full description read from the live Naukri job page' } };
      }
      const jobs = normalizeNaukriCards(snapshot.cards);
      return jobs.length ? { status: 'available', jobs, message: `Retrieved ${jobs.length} live Naukri openings from the first results page. Fetch a complete JD before tailoring; confirm the location and requirements.` } : { status: 'unavailable', jobs: [], message: 'Naukri rendered no recognizable job cards. Its page may have changed. Open Naukri and import selected jobs.' };
    } catch (error) {
      return { status: 'unavailable', message: error.name === 'TimeoutError' ? 'Naukri browser loading timed out. Retry or import the description manually.' : 'Naukri browser collection failed. Check that Chrome or Edge is installed and retry, or import the description manually.' };
    } finally { await context?.close().catch(() => {}); await browser?.close().catch(() => {}); busy = false; }
  };
}
export const renderNaukri = createNaukriBrowser();
