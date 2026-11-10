import { extractProfile } from '../../features/resume/utils/resume.mjs';
import { jobAnalysis } from '../../features/tailoring/utils/tailor-resume.mjs';
import { companyOrders, mncCompany } from '../../features/employers/utils/company-priority.mjs';

// Keep the existing localStorage schema, normalization and bounded match cache.
export function createAppStore(onStorageError) {
  let state = {
    resume: "",
    profile: null,
    filename: "",
    revision: "",
    jobs: [],
    sources: [],
    fetched: null,
    watchedCompanies: {},
    companyOrder: "match",
  };
  try {
    const saved = JSON.parse(localStorage.getItem("job-applier") || "null");
    if (saved && Array.isArray(saved.jobs))
      state = {
        ...state,
        ...saved,
        jobs: saved.jobs.map((job) => ({
          ...job,
          selected: job.selected ?? Boolean(job.status),
        })),
        profile: saved.resume
          ? saved.profile || extractProfile(saved.resume)
          : null,
        revision: saved.revision || crypto.randomUUID(),
      };
  } catch {}
  if (!companyOrders.includes(state.companyOrder))
    state.companyOrder = "mnc-first";
  if (state.searchProfile?.revision === state.revision && state.profile) {
    state.profile.roles = state.searchProfile.plan.roles.map(x => x.title);
    state.profile.skills = state.searchProfile.plan.keywords.map(x => x.name);
  }
  if (state.currentSearch?.revision !== state.revision) { state.currentSearch = null; state.sources = []; }
  if (state.currentSearch?.status === 'searching') state.currentSearch = { ...state.currentSearch, status: 'failed', code: 'SEARCH_INTERRUPTED', message: 'This page reloaded before the search finished. Retry when the connection is ready.' };

  function save() {
    // Keep the large live feed in memory; persist selected/manual jobs and a small match cache.
    const retained = state.jobs.filter(
      (job) => job.selected || !job.source || job.source === "Manual",
    );
    const prioritizeMncs = ["mnc-first", "mnc-only"].includes(state.companyOrder);
    const matches = state.profile
      ? state.jobs
          .filter((job) => !retained.includes(job))
          .map((job) => ({ job, analysis: job.aiFit ? { relevant: true, rank: job.aiFit.score } : jobAnalysis(state.profile, job) }))
          .filter((x) => x.analysis.relevant)
          .sort(
            (a, b) =>
              (prioritizeMncs
                ? Number(Boolean(mncCompany(b.job.company))) -
                  Number(Boolean(mncCompany(a.job.company)))
                : 0) || b.analysis.rank - a.analysis.rank,
          )
          .slice(0, 80)
          .map((x) => x.job)
      : [];
    try {
      localStorage.setItem(
        "job-applier",
        JSON.stringify({ ...state, jobs: [...retained, ...matches] }),
      );
    } catch {
      onStorageError(
        "Browser storage is full or unavailable. Your current session still works; export your tracker before closing.",
      );
    }
  }

  return { state, save };
}
