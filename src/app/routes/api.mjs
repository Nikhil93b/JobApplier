import { handleJobSearchRoutes } from '../../features/job-search/routes/job-search-routes.mjs';
import { handleAIReviewRoutes } from '../../features/ai-review/routes/ai-review-routes.mjs';
import { handleResumeRoutes } from '../../features/resume/routes/resume-routes.mjs';
import { handleJobImportRoutes } from '../../features/job-import/routes/job-import-routes.mjs';

// The server applies the original origin/local-request guards before dispatch.
export async function routeApiRequest(req, res, url, services) {
  for (const handle of [handleJobImportRoutes, handleJobSearchRoutes, handleAIReviewRoutes, handleResumeRoutes]) {
    if (await handle(req, res, url, services)) return true;
  }
  return false;
}
