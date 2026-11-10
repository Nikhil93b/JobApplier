import { json, body } from '../../../services/api/http.mjs';
import { recordSearchDiagnostic } from '../../../services/api/search-diagnostics.mjs';

export async function handleJobSearchRoutes(req, res, url, { ai, recordDiagnostics }) {
  if (req.method === 'POST') {
    if (url.pathname === '/api/ai/search-profile' || url.pathname === '/api/ai/search-jobs') {
      const input = JSON.parse((await body(req, 512 * 1024)).toString('utf8'));
      try {
        const result = url.pathname.endsWith('search-profile') ? await ai.planSearch(input) : await ai.searchJobs(input);
        if (recordDiagnostics && url.pathname.endsWith('search-jobs')) await recordSearchDiagnostic({ status: 'complete', acceptedJobs: result.jobs.length, diagnostics: result.diagnostics });
        json(res, 200, result);
      } catch (error) {
        if (recordDiagnostics && url.pathname.endsWith('search-jobs')) await recordSearchDiagnostic({ status: 'failed', code: error.code || 'AI_SEARCH_FAILED', message: error.message });
        json(res, error.status || 503, { error: error.message, code: error.code || 'AI_SEARCH_FAILED', jobs: [], status: 'failed', diagnostics: error.diagnostics });
      }
      return true;
    }
  }
  if (req.method === 'GET') {
    if (url.pathname === '/api/discover') { json(res, 410, { jobs: [], error: 'Fixed research leads are retired. Analyze your resume and use AI web search.' }); return true; }
  }
  return false;
}
