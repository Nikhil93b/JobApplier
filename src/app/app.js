import { $, message } from '../shared/utils/dom.js';
import { createAppStore } from './store/state.js';
import { createControls } from './controls.js';
import { createWorkspaceRoutes } from './routes/workspace.js';
import { createResumeFeature } from '../features/resume/components/resume-profile.js';
import { createJobSearchFeature } from '../features/job-search/components/job-search.js';
import { createEmployersFeature } from '../features/employers/components/employers.js';
import { createTrackerFeature } from '../features/application-tracker/components/application-tracker.js';
import { createJobImportFeature } from '../features/job-import/components/job-import.js';
import { createTailoringFeature } from '../features/tailoring/components/tailoring.js';
import { createAIReviewFeature } from '../features/ai-review/components/ai-review.js';

export function startApp() {
  const { state, save } = createAppStore(message);
  // Transient coordination only; persisted data remains in the existing store.
  const runtime = { activeJob: null, pageSize: 24, companyPageSize: 12, importTarget: null, searchGeneration: 0, aiBusy: false, researchBusy: false, naukriBusy: false, pendingCapture: null, pendingResumeFile: null, resumeBusy: false, loadingNaukriJobs: new Set() };
  const { syncDiscoveryButtons, syncResumeSubmit } = createControls({ state, runtime });

  // Callback closures resolve after composition; feature modules never import one another's controllers.
  const search = createJobSearchFeature({ state, runtime, save, syncDiscoveryButtons,
    renderProfile: () => resume.renderProfile(), renderCompanies: () => employers.renderCompanies(),
    renderTracker: () => tracker.renderTracker(), openTailor: id => tailoring.openTailor(id) });
  const resume = createResumeFeature({ state, runtime, save, syncDiscoveryButtons, syncResumeSubmit,
    renderAIReview: (...args) => review.renderAIReview(...args), renderAIContext: () => review.renderAIContext(),
    renderSearchProfile: () => search.renderSearchProfile(), resetFilters: (...args) => search.resetFilters(...args),
    renderJobs: () => search.renderJobs(), renderCompanies: () => employers.renderCompanies() });
  const employers = createEmployersFeature({ state, runtime, currentSearchJobs: () => search.currentSearchJobs() });
  const tracker = createTrackerFeature({ state, save, openTailor: id => tailoring.openTailor(id),
    downloadResume: (...args) => tailoring.downloadResume(...args) });
  const imports = createJobImportFeature({ state, runtime, save, renderJobs: () => search.renderJobs(),
    visibleJobs: () => search.visibleJobs(), openTailor: id => tailoring.openTailor(id) });
  const tailoring = createTailoringFeature({ state, runtime, save, renderJobs: () => search.renderJobs(),
    renderTracker: () => tracker.renderTracker(), renderAIReview: (...args) => review.renderAIReview(...args),
    beginImport: (...args) => imports.beginImport(...args), loadNaukriJD: job => imports.loadNaukriJD(job) });
  const review = createAIReviewFeature({ state, runtime, save, syncDiscoveryButtons,
    setDownloadState: () => tailoring.setDownloadState(), renderTracker: () => tracker.renderTracker() });
  const workspace = createWorkspaceRoutes({ renderAIContext: () => review.renderAIContext(),
    consumeCaptureFragment: () => imports.consumeCaptureFragment() });

  for (const feature of [search, imports, resume, review, tailoring, employers, tracker]) feature.bindEvents();
  $("clear").addEventListener("click", () => {
    if (
      confirm("Delete the locally stored resume, jobs, and tailored versions?")
    ) {
      localStorage.removeItem("job-applier");
      location.reload();
    }
  });
  resume.renderProfile();
  search.renderSearchProfile();
  search.renderJobs();
  employers.renderCompanies();
  if (state.profile) {
    resume.uploadStatus(
      "Your saved resume is ready. Search results restore only from its latest AI search. Choose a new file to replace your resume, or click “Save resume” to save a replacement. Analyze the resume before searching online.",
    );
    $("selected-file").textContent =
      "Saved resume available. Choose a new file only to replace it.";
  }
  workspace.bindEvents();
  workspace.syncWorkspace(location.hash === '#ai');
  imports.consumeCaptureFragment();
}

startApp();
