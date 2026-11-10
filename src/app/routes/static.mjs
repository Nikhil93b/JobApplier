import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../../../', import.meta.url);
const files = {
  "/": ["index.html","text/html"],
  "/app.js": ["app.js","text/javascript"],
  "/match.mjs": ["src/shared/utils/match.mjs","text/javascript","/src/shared/utils/match.mjs"],
  "/resume.mjs": ["src/features/resume/utils/resume.mjs","text/javascript","/src/features/resume/utils/resume.mjs"],
  "/pune.mjs": ["src/shared/utils/pune.mjs","text/javascript","/src/shared/utils/pune.mjs"],
  "/companies.mjs": ["src/features/employers/constants/companies.mjs","text/javascript","/src/features/employers/constants/companies.mjs"],
  "/company-priority.mjs": ["src/features/employers/utils/company-priority.mjs","text/javascript","/src/features/employers/utils/company-priority.mjs"],
  "/discovery.mjs": ["src/features/job-import/utils/discovery.mjs","text/javascript","/src/features/job-import/utils/discovery.mjs"],
  "/jobs.mjs": ["src/shared/utils/jobs.mjs","text/javascript","/src/shared/utils/jobs.mjs"],
  "/naukri-page.mjs": ["src/services/integrations/naukri/naukri-page.mjs","text/javascript","/src/services/integrations/naukri/naukri-page.mjs"],
  "/naukri-capture.mjs": ["src/services/integrations/naukri/naukri-capture.mjs","text/javascript","/src/services/integrations/naukri/naukri-capture.mjs"],
  "/style.css": ["src/styles/style.css","text/css"],
  "/src/app/app.js": ["src/app/app.js","text/javascript"],
  "/src/features/resume/utils/resume.mjs": ["src/features/resume/utils/resume.mjs","text/javascript"],
  "/src/features/employers/utils/company-priority.mjs": ["src/features/employers/utils/company-priority.mjs","text/javascript"],
  "/src/features/employers/constants/companies.mjs": ["src/features/employers/constants/companies.mjs","text/javascript"],
  "/src/features/job-import/utils/discovery.mjs": ["src/features/job-import/utils/discovery.mjs","text/javascript"],
  "/src/shared/utils/match.mjs": ["src/shared/utils/match.mjs","text/javascript"],
  "/src/shared/utils/pune.mjs": ["src/shared/utils/pune.mjs","text/javascript"],
  "/src/shared/utils/jobs.mjs": ["src/shared/utils/jobs.mjs","text/javascript"],
  "/src/services/integrations/naukri/naukri-page.mjs": ["src/services/integrations/naukri/naukri-page.mjs","text/javascript"],
  "/src/services/integrations/naukri/naukri-capture.mjs": ["src/services/integrations/naukri/naukri-capture.mjs","text/javascript"],
  "/src/features/job-search/services/job-search-api.js": ["src/features/job-search/services/job-search-api.js","text/javascript"],
  "/src/features/resume/services/resume-api.js": ["src/features/resume/services/resume-api.js","text/javascript"],
  "/src/features/job-import/services/job-import-api.js": ["src/features/job-import/services/job-import-api.js","text/javascript"],
  "/src/features/ai-review/services/ai-review-api.js": ["src/features/ai-review/services/ai-review-api.js","text/javascript"],
  "/src/features/tailoring/services/tailoring-api.js": ["src/features/tailoring/services/tailoring-api.js","text/javascript"],
  "/src/shared/utils/dom.js": ["src/shared/utils/dom.js","text/javascript"],
  "/src/app/store/state.js": ["src/app/store/state.js","text/javascript"],
  "/src/app/controls.js": ["src/app/controls.js","text/javascript"],
  "/src/features/resume/components/resume-profile.js": ["src/features/resume/components/resume-profile.js","text/javascript"],
  "/src/features/job-search/components/job-search.js": ["src/features/job-search/components/job-search.js","text/javascript"],
  "/src/features/employers/components/employers.js": ["src/features/employers/components/employers.js","text/javascript"],
  "/src/features/application-tracker/components/application-tracker.js": ["src/features/application-tracker/components/application-tracker.js","text/javascript"],
  "/src/features/job-import/components/job-import.js": ["src/features/job-import/components/job-import.js","text/javascript"],
  "/src/features/tailoring/components/tailoring.js": ["src/features/tailoring/components/tailoring.js","text/javascript"],
  "/src/features/ai-review/components/ai-review.js": ["src/features/ai-review/components/ai-review.js","text/javascript"],
  "/src/app/routes/workspace.js": ["src/app/routes/workspace.js","text/javascript"],
  "/src/features/tailoring/utils/tailor-resume.mjs": ["src/features/tailoring/utils/tailor-resume.mjs","text/javascript"],
};

export async function serveStaticFile(pathname, res) {
  const entry = files[pathname]; if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-cache' });
  res.end(entry[2] ? `export * from ${JSON.stringify(entry[2])};\n` : await readFile(new URL(entry[0], projectRoot)));
}
