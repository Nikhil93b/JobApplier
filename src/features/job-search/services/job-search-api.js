// Preserve endpoint payloads and return the original Response for feature-specific handling.
export function searchJobs(plan, token) {
  return fetch('/api/ai/search-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: plan, token: token }) });
}

export function analyzeSearchProfile(resume) {
  return fetch('/api/ai/search-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume: resume }) });
}
