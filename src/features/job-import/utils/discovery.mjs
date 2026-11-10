export function boardToken(value) {
  const input = value.trim();
  if (/^[a-z0-9_-]{1,100}$/i.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname)) return null;
    const token = url.pathname.split('/').filter(Boolean)[0];
    return /^[a-z0-9_-]{1,100}$/i.test(token || '') ? token : null;
  } catch { return null; }
}
export function normalizeJobs(payload, company) {
  if (!Array.isArray(payload.jobs)) throw new Error('Unexpected response from the company board.');
  return payload.jobs.filter(job => typeof job.title === 'string' && /^https:\/\//i.test(job.absolute_url || '')).map(job => ({
    sourceId: String(job.id), title: job.title, company, location: job.location?.name || '',
    descriptionHtml: String(job.content || ''), url: job.absolute_url, source: 'Greenhouse', updated: job.updated_at || null
  }));
}
export function parseProfile(text) {
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  const list = key => { if (value[key] === undefined) return undefined; if (!Array.isArray(value[key]) || value[key].some(x => typeof x !== 'string')) throw new Error(`${key} must be a list of text values.`); return value[key].map(x => x.trim()).filter(Boolean).join(', '); };
  const result = {};
  for (const [key, target] of [['skills', 'extra'], ['roles', 'role'], ['locations', 'location']]) { const parsed = list(key); if (parsed !== undefined) result[target] = parsed; }
  for (const key of ['name', 'resume']) { if (value[key] !== undefined) { if (typeof value[key] !== 'string') throw new Error(`${key} must be text.`); result[key] = value[key]; } }
  if (!Object.keys(result).length) throw new Error('Include skills, roles, locations, name, or resume.');
  return result;
}
export function matchesPreferences(job, role, location) {
  const terms = value => value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const roles = terms(role), locations = terms(location);
  return (!roles.length || roles.some(x => job.title.toLowerCase().includes(x))) &&
    (!locations.length || locations.some(x => (job.location || '').toLowerCase().includes(x)));
}
