import { $, el, link } from '../../../shared/utils/dom.js';
import { regionMatch } from '../../../shared/utils/pune.mjs';
import { updateJob } from '../../../shared/utils/jobs.mjs';
import { companyOrders, mncCompany, orderCompanyJobs } from '../../employers/utils/company-priority.mjs';
import * as jobSearchApi from '../services/job-search-api.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createJobSearchFeature({ state, runtime, save, syncDiscoveryButtons, renderProfile, renderCompanies, renderTracker, openTailor }) {
  function renderSearchProfile() {
    const box = $('search-profile-results'); box.replaceChildren();
    const current = state.searchProfile?.revision === state.revision;
    $('search-plan-status').textContent = state.searchProfile?.needsAnalysis ? 'Your saved search profile needs to be refreshed. Choose Analyze resume for job search again.' : current ? 'Search profile ready. AI will search only these roles.' : 'Save your resume, then analyze it to choose search roles and technical keywords.';
    if (!current) return;
    const plan = state.searchProfile.plan;
    box.append(el('p', plan.summary));
    for (const role of plan.roles) {
      const card = el('article', undefined, 'search-card'); card.append(el('h3', role.title), el('p', role.reason), el('blockquote', role.evidence)); box.append(card);
    }
    const chips = el('div', undefined, 'chips');
    chips.append(...plan.keywords.map(x => el('span', `${x.name} - ${x.source === 'skills' ? 'skills section' : 'recent work'}`, 'chip'))); box.append(chips);
    box.append(el('p', plan.experienceYears === null ? 'Experience is uncertain; AI will flag requirements for review.' : `Resume experience: ${plan.experienceYears} years. ${plan.experienceEvidence}`, 'small'));
  }

  function resetFilters(showAll = false) {
    $("region-scope").value = showAll ? "all" : "pune";
    $("threshold").value = "0";
    $("job-view").value = showAll ? "all" : "relevant";
    $("title-filter").checked = !showAll;
    $("experience-filter").checked = !showAll;
    state.companyOrder = "match";
    $("company-priority").value = state.companyOrder;
    runtime.pageSize = 24;
    save();
    renderJobs();
  }

  function renderFilterHelp() {
    const scope = $("region-scope").value,
      threshold = Number($("threshold").value),
      view = $("job-view").value;
    $("location-help").textContent = scope.startsWith("hinjewadi-")
      ? "Only jobs explicitly listing this phase. Jobs saying just “Hinjewadi” are in the all-phases view."
      : scope === "hinjewadi"
        ? "Includes Phases 1, 2 and 3, plus Hinjewadi jobs with no stated phase."
        : scope === "pune"
          ? "Includes Pune and target localities. Jobs keep their AI fit order unless you choose company priority."
          : scope === "local"
            ? "Only Baner, Balewadi and Hinjewadi, including listings with no stated Hinjewadi phase."
            : scope === "baner-balewadi"
              ? "Only jobs whose location lists Baner or Balewadi."
              : "Includes every saved location, including jobs with an unspecified location.";
    $("company-priority-help").textContent = {
      "mnc-first":
        "Shows all employers, with recognized major MNCs first. Keeps other companies visible.",
      match:
        "Shows all employers, ordered by AI fit score. No MNC preference.",
      "mnc-only":
        "Hides every employer outside our major-MNC list. This can leave no results.",
      "other-only":
        "Hides recognized major MNCs. Includes other and unclassified employers.",
    }[state.companyOrder];
    $("threshold-value").textContent = `${threshold}/100`;
    $('threshold-help').textContent = `Keeps current results with an AI fit score of at least ${threshold}/100. This is not a hiring probability.`;
    $('job-view-help').textContent = view === 'shortlist' ? 'Only shortlisted jobs from the current AI search. Other filters still apply.' : 'Shows jobs from the current AI search only. Previous research and imported jobs are not discovery results.';
    const labels = [
      $("region-scope").selectedOptions[0].textContent,
      $("company-priority").selectedOptions[0].textContent,
      $("job-view").selectedOptions[0].textContent,
    ];
    if (threshold) labels.push(`AI fit >= ${threshold}/100`);


    $("active-filters").replaceChildren(
      ...labels.map((label) => el("span", label, "chip")),
    );
    $("partial-filter-note").hidden = true;
  }

  function renderSearchStatus() {
    const search = state.currentSearch?.revision === state.revision ? state.currentSearch : null;
    $('discovery-status').textContent = search?.message || (search?.status === 'failed' ? 'The previous AI search failed. Analyze your resume again if needed, then retry the search.' : search?.status === 'complete' ? `${currentSearchJobs().length} jobs from the last AI search.` : state.searchProfile?.revision === state.revision ? 'Resume analysis is ready. Choose Search jobs with AI to retrieve openings.' : 'No job search has run for this resume. Analyze it in Step 1, then search here.');
    const details = $('search-diagnostics'), content = $('search-diagnostic-details');
    details.hidden = !search?.diagnostics; content.replaceChildren();
    if (search?.diagnostics) {
      const d = search.diagnostics;
      content.append(el('p', `${d.webSearches} web searches; ${d.readablePages} readable source pages; ${d.proposedJobs} proposed vacancies; ${d.acceptedJobs} accepted.`));
      const labels = { invalid_job_link: 'invalid vacancy links', source_page_not_readable: 'source pages not read', duplicate: 'duplicates', different_role: 'other roles', invalid_details_or_evidence: 'incomplete details or source evidence', outside_target_location: 'outside the target locations', experience_mismatch: 'experience mismatches', invalid_details: 'invalid listing details' };
      for (const [reason, count] of Object.entries(d.rejected || {})) content.append(el('p', `${count} excluded: ${labels[reason] || reason}.`));
    }
  }

  function currentSearchJobs() {
    if (!state.profile || state.currentSearch?.revision !== state.revision || state.currentSearch.status !== 'complete') return [];
    if (!Array.isArray(state.currentSearch.ids)) return [];
    const ids = new Set(state.currentSearch.ids);
    return state.jobs.filter(job => ids.has(job.id) && job.aiFit && job.searchRevision === state.revision && job.source !== 'Company research');
  }

  function renderEmptyResults() {
    const box = el('div', undefined, 'empty');
    const ready = state.searchProfile?.revision === state.revision && !state.searchProfile?.needsAnalysis;
    const search = state.currentSearch?.revision === state.revision ? state.currentSearch : null;
    const emptyReason = runtime.researchBusy ? 'Searching the web and checking source pages. Results appear when the search completes.' : currentSearchJobs().length ? 'The search found jobs, but your current filters hide them. Reset the filters to see the results.' : search?.status === 'failed' ? search.message || 'The previous search failed. Retry the search or refresh the resume analysis.' : search?.status === 'complete' ? 'The search completed without supported vacancies. See Search details above for retrieval and exclusion counts.' : ready ? 'Your resume is analyzed, but no job search has run yet. Choose Search jobs with AI.' : 'Analyze your submitted resume first, then start an AI job search.';
    box.append(el('h3', runtime.researchBusy ? 'Searching for current openings...' : 'No AI job results to show'), el('p', emptyReason));
    if (currentSearchJobs().length) { const reset = el('button', 'Reset filters', 'secondary'); reset.addEventListener('click', () => resetFilters()); box.append(reset); }
    else if (!runtime.researchBusy) {
      const action = el('button', ready ? 'Search jobs with AI' : 'Analyze resume again', 'secondary');
      action.disabled = runtime.aiBusy || runtime.resumeBusy || runtime.naukriBusy;
      action.addEventListener('click', ready ? discover : analyzeSearchProfile); box.append(action);
    }
    $('results').append(box);
  }

  function visibleJobs() {
    const view = $('job-view').value, threshold = Number($('threshold').value);
    const jobs = currentSearchJobs().map(job => ({ ...job, analysis: {
      score: job.aiFit.score, rank: job.aiFit.score, relevant: true, roleMatch: true,
      matched: job.aiFit.matched, missing: job.aiFit.missing,
      experience: { status: job.aiFit.experienceFit, label: job.aiFit.experienceFit === 'within' ? 'AI: experience aligns with the published requirements' : 'Experience requirement needs review' }
    } })).filter(job => regionMatch(job, $('region-scope').value) && (view !== 'shortlist' || job.selected) && job.aiFit.score >= threshold);
    return orderCompanyJobs(jobs, state.companyOrder);
  }

  function renderJobs() {
    const jobs = visibleJobs();
    renderSearchStatus();
    $("job-controls").hidden = !state.profile;
    $("fit-controls").hidden = !state.profile;
    $("search-workspace").hidden = !state.profile;
    $("jobs-before-resume").hidden = Boolean(state.profile);
    $("count").textContent = state.profile
      ? `${jobs.length} matching job${jobs.length === 1 ? "" : "s"}`
      : "";
    $("results-context").textContent = state.profile
      ? `Using ${state.filename || "your saved resume"} · ${currentSearchJobs().length} jobs from the current AI search. Check each source to confirm the job is still open.`
      : "";
    $("results").replaceChildren();
    $("more").hidden = jobs.length <= runtime.pageSize;
    renderFilterHelp();
    $("source-summary").replaceChildren(
      ...state.sources.map((source) =>
        el(
          "span",
          `${source.name}: ${source.ok ? source.count + " leads" : "unavailable"}`,
          source.ok ? "chip" : "chip missing",
        ),
      ),
    );
    for (const job of jobs.slice(0, runtime.pageSize)) {
      const card = el("article", undefined, "job"),
        row = el("div", undefined, "row"),
        title = el("div");
      title.append(
        el("h3", job.title),
        el("p", [job.company, job.location].filter(Boolean).join(" · ")),
      );
      row.append(
        title,
        el(
          "span",
          `${job.aiFit.score}/100 AI fit`,
          "score",
        ),
      );
      card.append(row);
      const chips = el("div", undefined, "chips");
      chips.append(
        el(
          "span",
          mncCompany(job.company) ? "Major MNC" : "Other / unclassified",
          "chip",
        ),
        ...job.analysis.matched.map((skill) => el("span", skill, "chip")),
      );
      card.append(chips);
      card.append(el('p', job.aiFit.reason, 'small'));
      if (job.aiFit.missing.length) card.append(el('p', `Requirements to review: ${job.aiFit.missing.join(', ')}`, 'small'));
      card.append(el("p", job.analysis.experience.label, "small"));
      if (job.evidenceLevel)
        card.append(
          el(
            "p",
            `${job.evidenceLevel} · checked ${job.checkedAt}. Recheck availability on the source.`,
            "small",
          ),
        );
      const details = el("details");
      details.append(
        el(
          "summary",
          job.partialDescription
            ? "Read available summary"
            : "Read full job description",
        ),
        el("p", job.description, "description"),
      );
      card.append(details);
      const actions = el("div", undefined, "actions"),
        tailor = el(
          "button",
          job.tailored ? "Review tailored resume" : "Select & tailor resume",
        ),
        select = el(
          "button",
          job.selected ? "Remove from shortlist" : "Shortlist",
          "secondary",
        );
      tailor.addEventListener("click", () => openTailor(job.id));
      select.addEventListener("click", () => {
        const stored = state.jobs.find((x) => x.id === job.id);
        stored.selected = !stored.selected;
        save();
        renderJobs();
      });
      actions.append(tailor, select, link(job.url, "View opening ↗"));
      card.append(actions);
      $("results").append(card);
    }
    if (!jobs.length && state.profile) renderEmptyResults();
    renderTracker();
  }

  async function discover() {
    if (!state.profile || state.searchProfile?.revision !== state.revision || state.searchProfile?.needsAnalysis || runtime.researchBusy || runtime.naukriBusy || runtime.aiBusy) return false;
    const generation = ++runtime.searchGeneration, revision = state.revision;
    runtime.researchBusy = true; state.currentSearch = { revision, ids: [], status: 'searching', message: 'Codex is searching current sources and ranking jobs for your analyzed roles. This can take a few minutes.' }; state.sources = []; save(); renderJobs(); renderCompanies(); syncDiscoveryButtons();
    $('discovery-status').textContent = 'Codex is searching current sources and ranking jobs for your analyzed roles. This can take a few minutes.';
    try {
      const response = await jobSearchApi.searchJobs(state.searchProfile.plan, state.searchProfile.token);
      const data = await response.json(); if (!response.ok) throw Object.assign(new Error(data.error || 'AI job search failed.'), { code: data.code, diagnostics: data.diagnostics });
      if (generation !== runtime.searchGeneration || revision !== state.revision) return false;
      if (!Array.isArray(data.jobs)) throw new Error('AI returned an invalid job list.');
      for (const job of data.jobs) {
        const previous = state.jobs.find(x => x.url === job.url);
        if (previous) updateJob(previous, { ...job, id: previous.id, searchRevision: revision });
        else state.jobs.push({ ...job, id: crypto.randomUUID(), searchRevision: revision });
      }
      state.currentSearch = { revision, ids: data.jobs.map(job => state.jobs.find(x => x.url === job.url).id), status: 'complete', diagnostics: data.diagnostics, message: `${data.jobs.length} supported job opening(s). ${data.summary || ''}${data.discarded ? ` ${data.discarded} unsupported result(s) were discarded.` : ''}` };
      state.sources = [{ name: 'Codex live web search', ok: true, count: data.jobs.length }]; state.fetched = data.fetched;
      $('discovery-status').textContent = `${data.jobs.length} supported job opening(s). ${data.summary || ''}${data.discarded ? ` ${data.discarded} unsupported result(s) were discarded.` : ''}`;
      save(); renderJobs(); renderCompanies(); return true;
    } catch (error) {
      if (generation === runtime.searchGeneration && revision === state.revision) {
        state.currentSearch = { revision, ids: [], status: 'failed', code: error.code, diagnostics: error.diagnostics, message: `AI job search failed: ${error.message} No results are shown.` }; state.sources = [];
        if (error.code === 'SEARCH_PROFILE_EXPIRED') { state.searchProfile.needsAnalysis = true; renderSearchProfile(); }
        $('discovery-status').textContent = `AI job search failed: ${error.message} No results are shown.`; save(); renderJobs(); renderCompanies();
      }
      return false;
    } finally { runtime.researchBusy = false; syncDiscoveryButtons(); renderJobs(); }
  }

  async function analyzeSearchProfile() {
    if (!state.profile || runtime.aiBusy || runtime.researchBusy || runtime.resumeBusy || runtime.naukriBusy) return;
    const revision = state.revision; runtime.aiBusy = true; delete state.searchProfile; state.currentSearch = null; save(); renderSearchProfile(); renderJobs(); renderCompanies(); syncDiscoveryButtons();
    $('search-plan-status').textContent = 'Analyzing recent work, technical skills, development methods and experience...';
    try {
      const response = await jobSearchApi.analyzeSearchProfile(state.resume);
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Resume analysis failed.');
      if (revision !== state.revision) return;
      state.searchProfile = { ...data, revision };
      state.profile.roles = data.plan.roles.map(x => x.title); state.profile.skills = data.plan.keywords.map(x => x.name);
      state.profile.experienceYears = data.plan.experienceYears; state.profile.experience = data.plan.experienceYears === null ? '' : `${data.plan.experienceYears} years supported by AI analysis`;
      resetFilters(); save(); renderProfile(); renderJobs(); renderCompanies();
    } catch (error) { if (revision === state.revision) $('search-plan-status').textContent = `Analysis failed: ${error.message} No jobs have been searched.`; }
    finally { runtime.aiBusy = false; syncDiscoveryButtons(); renderJobs(); }
  }

  function bindEvents() {
    $('analyze-search').addEventListener('click', analyzeSearchProfile);
    $('ai-find-jobs').addEventListener('click', discover);
    $('search-jobs-results').addEventListener('click', discover);
    $('naukri-live').addEventListener('click', discover);
    $("refresh").addEventListener("click", discover);
    for (const key of [
      "threshold",
      "job-view",
      "region-scope",
      "experience-filter",
      "title-filter",
    ])
      $(key).addEventListener("input", () => {
        runtime.pageSize = 24;
        $("threshold-value").textContent = `${$("threshold").value}%`;
        renderJobs();
      });
    $("more").addEventListener("click", () => {
      runtime.pageSize += 24;
      renderJobs();
    });
    $("company-priority").value = state.companyOrder;
    $("company-priority").addEventListener("input", () => {
      state.companyOrder = companyOrders.includes($("company-priority").value)
        ? $("company-priority").value
        : "mnc-first";
      runtime.pageSize = 24;
      save();
      renderJobs();
    });
    $("reset-filters").addEventListener("click", () => resetFilters());
    $("include-partial").addEventListener("click", () => {
      $("threshold").value = "0";
      runtime.pageSize = 24;
      renderJobs();
    });
  }

  return { renderSearchProfile, resetFilters, currentSearchJobs, visibleJobs, renderJobs, discover, bindEvents };
}
