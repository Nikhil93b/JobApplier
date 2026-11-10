import { $ } from '../shared/utils/dom.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createControls({ state, runtime }) {
  function syncDiscoveryButtons() {
    const disabled = !state.profile || runtime.resumeBusy || runtime.researchBusy || runtime.naukriBusy || runtime.aiBusy || $('upload').disabled;
    for (const id of ['refresh', 'naukri-live', 'import-new', 'guide-import', 'capture-confirm']) $(id).disabled = disabled;
    $('analyze-search').disabled = disabled;
    for (const id of ['ai-profile', 'ai-job']) $(id).disabled = !state.profile || runtime.aiBusy || runtime.researchBusy || runtime.naukriBusy;
    $('ai-check').disabled = runtime.aiBusy || runtime.researchBusy || runtime.naukriBusy;
    $('ai-find-jobs').disabled = disabled || state.searchProfile?.revision !== state.revision || state.searchProfile?.needsAnalysis;
    $('search-jobs-results').disabled = $('ai-find-jobs').disabled;
    $('analyze-search').textContent = runtime.aiBusy ? 'Analyzing...' : 'Analyze resume for job search';
    $('ai-find-jobs').textContent = runtime.researchBusy ? 'Searching online...' : 'Search jobs with AI';
    $('search-jobs-results').textContent = $('ai-find-jobs').textContent;
    syncResumeSubmit();
  }

  function syncResumeSubmit() {
    $('resume-submit').disabled = $('upload').disabled || runtime.resumeBusy || runtime.researchBusy || runtime.naukriBusy || runtime.aiBusy || !runtime.pendingResumeFile;
    $('resume-submit').textContent = runtime.resumeBusy ? 'Reading your resume...' : 'Save resume';
  }

  function bindEvents() {

  }

  return { syncDiscoveryButtons, syncResumeSubmit, bindEvents };
}
