import { naukriSearches } from '../../../shared/utils/pune.mjs';
import { renderNaukri, naukriJobUrl } from './naukri-browser.mjs';

// Public structured data only. Never execute scripts from a retrieved page.
export function parseNaukri(html) {
  const jobs = new Map();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if ([value['@type']].flat().includes('JobPosting') && typeof value.title === 'string') {
      let url; try { url = new URL(value.url); } catch { return; }
      if (url.protocol !== 'https:' || url.hostname !== 'www.naukri.com' || !url.pathname.startsWith('/job-listings-')) return;
      const locations = [value.jobLocation].flat().filter(Boolean).map(x => [x.address?.addressLocality, x.address?.addressRegion].filter(Boolean).join(', '));
      jobs.set(url.href, { sourceId: url.pathname, source: 'Naukri', title: value.title, company: value.hiringOrganization?.name || '', location: locations.join('; '), url: url.href, descriptionHtml: typeof value.description === 'string' ? value.description : '', partialDescription: true, evidenceLevel: 'Public structured listing; import the complete JD before tailoring', checkedAt: new Date().toISOString().slice(0, 10) });
    }
    Object.values(value).forEach(visit);
  }
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(script[1])) continue;
    try { visit(JSON.parse(script[2])); } catch { /* One malformed block must not discard other listings. */ }
  }
  return [...jobs.values()];
}

export function createNaukriConnector(fetchPage = fetch, renderPage = renderNaukri) {
  const cache = new Map();
  return async profile => {
    const search = naukriSearches(profile).find(x => x.area === 'Pune');
    if (!search) throw new Error('Upload a resume first.');
    const cached = cache.get(search.url);
    if (cached && Date.now() - cached.time < 60000) return { ...await cached.result, cached: true };
    const result = (async () => {
      const fetched = new Date().toISOString();
      try {
        const response = await fetchPage(search.url, { signal: AbortSignal.timeout(18000), redirect: 'error', headers: { Accept: 'text/html' } });
        if (!response.ok) { const error = new Error(`Naukri returned HTTP ${response.status}. Open the search in your browser.`); error.sourceStatus = [401, 403, 429].includes(response.status) ? 'blocked' : 'unavailable'; throw error; }
        if (!/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('Naukri returned an unsupported response.');
        const chunks = []; let size = 0;
        for await (const chunk of response.body) { size += chunk.length; if (size > 3 * 1024 * 1024) throw new Error('Naukri page exceeded the size limit.'); chunks.push(chunk); }
        let jobs = parseNaukri(Buffer.concat(chunks).toString('utf8'));
        const rendered = jobs.length ? null : await renderPage(search.url);
        if (rendered) jobs = rendered.jobs || [];
        if (rendered && !['available', 'empty'].includes(rendered.status)) cache.delete(search.url);
        return { jobs, fetched, mode: 'naukri-live', searchUrl: search.url, sources: [{ name: 'Naukri live', ok: jobs.length > 0 || rendered?.status === 'empty', count: jobs.length }], status: rendered?.status || 'available', message: rendered?.message || `Retrieved ${jobs.length} public listings. Fetch a complete JD before tailoring.` };
      } catch (error) {
        cache.delete(search.url);
        return { jobs: [], fetched, mode: 'naukri-live', searchUrl: search.url, status: error.sourceStatus || 'unavailable', sources: [{ name: 'Naukri live', ok: false, count: 0 }], message: error.name === 'TimeoutError' ? 'Naukri timed out. Open the search in your browser.' : error.message };
      }
    })();
    if (cache.size >= 30) cache.delete(cache.keys().next().value);
    cache.set(search.url, { time: Date.now(), result });
    return result;
  };
}
export const fetchNaukri = createNaukriConnector();
const detailCache = new Map();
export async function fetchNaukriDetail(value) {
  const url = naukriJobUrl(value);
  if (!url) { const error = new Error('Provide a valid HTTPS Naukri job-listings URL.'); error.status = 400; throw error; }
  const cached = detailCache.get(url);
  if (cached && Date.now() - cached.time < 60000) return { ...await cached.result, cached: true };
  const result = renderNaukri(url, { detail: true }).then(data => { if (!['available', 'expired'].includes(data.status)) detailCache.delete(url); return data; }, error => { detailCache.delete(url); throw error; });
  if (detailCache.size >= 30) detailCache.delete(detailCache.keys().next().value);
  detailCache.set(url, { result, time: Date.now() });
  return result;
}
