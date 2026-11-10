import { $, el, link, download } from '../../../shared/utils/dom.js';
import { majorEmployers } from '../utils/company-priority.mjs';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createEmployersFeature({ state, runtime, currentSearchJobs }) {
  function renderCompanies() {
    const query = $('company-search').value.toLowerCase().trim(), area = $('company-area').value;
    const jobs = currentSearchJobs();
    const all = [...new Map(jobs.map(job => [job.company.toLowerCase(), job])).values()];
    const result = [...new Map(jobs.filter(job => (area === 'all' || job.location.toLowerCase().includes(area.toLowerCase())) && (!query || job.company.toLowerCase().includes(query))).map(job => [job.company.toLowerCase(), job])).values()];
    $('company-summary').textContent = runtime.researchBusy ? 'AI job search is running. Employers will appear when source checks finish.' : `${all.length} employers found by the current AI search; ${result.length} shown with your employer filters.${area !== 'all' ? ` Area: ${area}.` : ''}`;
    $('company-results').replaceChildren(); $('company-more').hidden = result.length <= runtime.companyPageSize;
    for (const job of result.slice(0, runtime.companyPageSize)) {
      const card = el('article', undefined, 'company-card'); card.append(el('h3', job.company), el('p', job.location), link(job.url, 'View searched opening')); $('company-results').append(card);
    }
    if (!result.length) {
      const box = el('div', undefined, 'empty');
      box.append(el('p', runtime.researchBusy ? 'Searching the web and checking job pages. Open Review matches for the current search status.' : all.length ? `AI found ${all.length} employer(s), but none match these employer filters. Listings that state only Pune are not assigned to Baner or Balewadi.` : state.currentSearch?.status === 'failed' ? 'The latest job search failed. Open Review matches to see the error and retry.' : state.currentSearch?.status === 'complete' ? 'The latest AI search returned no supported vacancies. Open Review matches for the search details.' : 'No completed job search is available. Analyze your resume and choose Search jobs with AI in Step 2.'));
      if (all.length) { const reset = el('button', 'Show all AI-found employers', 'secondary'); reset.addEventListener('click', () => { $('company-area').value = 'all'; $('company-search').value = ''; renderCompanies(); }); box.append(reset); }
      else { const back = el('a', 'Review AI job search', 'button secondary'); back.href = '#jobs'; box.append(back); }
      $('company-results').append(box);
    }
  }

  function bindEvents() {
    $("mnc-company-list").replaceChildren(
      ...majorEmployers.map((company) => {
        const a = el("a", company.name);
        a.href = company.source;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        const li = el("li");
        li.append(a);
        return li;
      }),
    );
    for (const key of ["company-search", "company-area", "company-hiring"])
      $(key).addEventListener("input", () => {
        runtime.companyPageSize = 12;
        renderCompanies();
      });
    $("company-more").addEventListener("click", () => {
      runtime.companyPageSize += 12;
      renderCompanies();
    });
    $('company-export').addEventListener('click', () => download(new Blob([JSON.stringify(currentSearchJobs().map(({company, location, url}) => ({company, location, url})), null, 2)], { type: 'application/json' }), 'ai-search-companies.json'));
  }

  return { renderCompanies, bindEvents };
}
