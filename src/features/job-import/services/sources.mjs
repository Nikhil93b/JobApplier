import { normalizeJobs } from '../utils/discovery.mjs';
export async function fetchBoard(token, company = token) {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`, { signal: AbortSignal.timeout(18000), redirect: 'error' });
  if (!response.ok) throw new Error(`Career board returned HTTP ${response.status}.`);
  return normalizeJobs(await response.json(), company);
}
