import { naukriJobUrl, normalizeNaukriCards, naukriPageState } from './naukri-page.mjs';

export const maxCaptureLength = 200000;
function fail(message) { throw new Error(message); }
export function capturePageUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && ['www.naukri.com', 'naukri.com'].includes(url.hostname) && !url.port && !url.username && !url.password ? `https://www.naukri.com${url.pathname}` : null; } catch { return null; }
}
export function makeNaukriCapture(snapshot, value) {
  const pageUrl = capturePageUrl(value); if (!pageUrl) fail('Open a Naukri search or job-description page first.');
  if (naukriPageState(200, snapshot) === 'blocked') fail('This page is an access check. Complete normal access yourself before importing jobs.');
  let jobs = normalizeNaukriCards(snapshot.cards);
  const detailUrl = naukriJobUrl(pageUrl);
  if (detailUrl) {
    if (naukriPageState(200, snapshot, true) === 'expired') fail('Naukri reports this job expired or removed.');
    if (![snapshot.heading, snapshot.company].every(x => typeof x === 'string' && x.trim()) || typeof snapshot.description !== 'string' || snapshot.description.trim().length < 80) fail('This page did not expose a title, employer and complete JD. Use manual import for this job.');
    jobs = [{ title: snapshot.heading, company: snapshot.company, location: snapshot.location || '', description: snapshot.description, url: detailUrl, partialDescription: false }];
  }
  if (!jobs.length) fail('No job cards were recognized on this page. Let Naukri finish loading, or open a full job description.');
  const payload = { version: 1, pageUrl, capturedAt: new Date().toISOString(), jobs };
  return validateNaukriCapture(payload);
}

export function validateNaukriCapture(input) {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  if (!value || value.version !== 1 || !capturePageUrl(value.pageUrl) || !Array.isArray(value.jobs) || !value.jobs.length || value.jobs.length > 20 || typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt)) || Date.parse(value.capturedAt) > Date.now() + 300000) fail('Invalid Naukri capture. Capture a search or job page with the browser helper.');
  if (JSON.stringify(value).length > maxCaptureLength) fail('The capture is too large. Import fewer jobs or a single description.');
  const pageUrl = capturePageUrl(value.pageUrl), capturedAt = new Date(value.capturedAt).toISOString(), jobs = new Map();
  for (const raw of value.jobs) {
    const url = naukriJobUrl(raw?.url);
    if (!url || !['title', 'company'].every(key => typeof raw[key] === 'string' && raw[key].trim() && raw[key].length <= 300) || typeof raw.description !== 'string' || raw.description.length > 40000 || typeof raw.partialDescription !== 'boolean' || (raw.location !== undefined && (typeof raw.location !== 'string' || raw.location.length > 500))) fail('A captured job has invalid title, employer, URL or description data.');
    if (!raw.partialDescription && (url !== naukriJobUrl(pageUrl) || raw.description.trim().length < 80 || value.jobs.length !== 1)) fail('A complete JD must come from its own Naukri job page.');
    jobs.set(url, { sourceId: new URL(url).pathname, source: 'Naukri', title: raw.title.trim(), company: raw.company.trim(), location: raw.location || '', description: raw.description.trim(), url, partialDescription: raw.partialDescription,
      capturedAt, checkedAt: capturedAt.slice(0, 10), evidenceLevel: raw.partialDescription ? 'Imported from your Naukri results page; availability not rechecked' : 'Complete JD imported from your Naukri job page; availability not rechecked' });
  }
  return { version: 1, pageUrl, capturedAt, jobs: [...jobs.values()] };
}

export function encodeNaukriCapture(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(validateNaukriCapture(value)));
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeNaukriCapture(value) {
  if (typeof value !== 'string' || value.length > maxCaptureLength * 4 || !/^[A-Za-z0-9_-]+$/.test(value)) fail('Invalid Naukri capture link.');
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return validateNaukriCapture(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, x => x.charCodeAt(0))));
}
