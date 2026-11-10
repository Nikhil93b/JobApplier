# Developed features and change log

Last updated: 22 October 2026. This file records delivered behavior and verification. Future work and acceptance criteria live in [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md). Older implementation notes are historical; the AI search workflow below supersedes the fixed-lead workflow.

## Current delivered workflow

1. Choose a PDF, Word `.docx`, or text resume and select **Save resume**. This parses text locally and makes no AI or job-search request.
2. Select **Analyze resume for job search**. Codex proposes up to five roles with exact resume evidence, technical keywords, development methods, and supported years of experience. The prompt prioritizes recent employment and the skills section. Generic soft/business skills are excluded.
3. Inspect the proposed roles and keywords, then select **Search jobs with AI**. Codex uses live web search for those roles and the analyzed keywords/experience, targeting Pune, Baner, Balewadi and Hinjewadi Phases 1/2/3. It searches Naukri first and then accessible employer/public job-board pages.
4. Display only results from the current AI search. Each accepted vacancy must have a public HTTPS source URL represented in an actual page-open event, a source excerpt, a suggested-role association, and a fit explanation. Failed page results, unopened URLs, duplicates, non-target locations and known experience mismatches are excluded. Batched page opens are supported.
5. Rank by AI fit by default. Display the score, technical overlap, requirements needing review and experience assessment. Optional company/location/score filters remain available. Scores are not hiring probabilities.
6. Show employers derived from the current search results. There is no fixed company directory or researched-lead fallback in discovery. The old `/api/discover` endpoint returns 410 and an empty jobs array.
7. Search failure or zero supported results produces an empty discovery list and empty employer suggestions. Previously successful results are cleared from discovery at the start of a new search. Saved application records are retained; broader replacement-resume history behavior is still deferred.
8. Import a complete JD before tailoring a search summary. Review and approve a separate tailored version before PDF/Word downloads. Applications remain manual.

## Delivery register

| Date | Deliverable | Main code | Status and verification |
|---|---|---|---|
| 14–18 October 2026 | Local Node HTTP application, vanilla JavaScript UI, PDF/Word/text parsing, optional profile correction | `server.mjs`, `app.js`, `documents.mjs`, `resume.mjs` | Delivered; parsing, upload limits, invalid-file recovery and served modules covered by automated tests |
| 14–18 October 2026 | Shortlists, job-specific drafts, approval invalidation, PDF/Word exports and manual application tracking | `jobs.mjs`, `documents.mjs`, `app.js` | Delivered; actual browser downloads checked |
| 15–18 October 2026 | Optional evidence-based AI resume review and job wording suggestions via local Codex/ChatGPT sign-in | `codex-ai.mjs` | Delivered; included-usage checks, exact evidence validation and no API-key fallback covered by tests |
| 15–18 October 2026 | Naukri public HTML/browser connector and explicit browser capture helper | `naukri*.mjs`, `browser-helper/` | Legacy optional tools; direct Naukri access remains blocked in live checks. These are not the primary discovery path |
| 17–18 October 2026 | Pune/locality filters, Hinjewadi phase matching and optional employer preference groups | `pune.mjs`, `company-priority.mjs` | Delivered. Current default order is AI fit; employer filters are optional |
| 18 October 2026 | Removed Search within results and corrected resume replacement filtering | `app.js`, `index.html` | Delivered in the earlier workflow; regression coverage retained/reworked for explicit AI search |
| 21 October 2026 | Separate resume-save, AI-search-analysis and AI-web-search actions | `app.js`, `index.html`, `codex-ai.mjs` | Delivered and verified in DOM and isolated Chrome; upload/navigation/reload start no inference |
| 21 October 2026 | AI role/keyword/experience search profile, signed with the local app key | `ai-job-search.mjs`, `codex-ai.mjs` | Delivered; changed plans are rejected; valid plans now survive restart with the persisted local signing key |
| 21 October 2026 | Codex live search, page-source checks, AI ranking and empty failures | `ai-job-search.mjs`, `codex-ai.mjs`, `server.mjs` | Delivered; a synthetic-resume live run produced 3 accepted jobs from 3 web-search events. This is an observed run, not guaranteed future availability |
| 21 October 2026 | Retired fixed job discovery and replaced static company suggestions | `sources.mjs`, `server.mjs`, `app.js` | Delivered; no fixed leads appear in discovery; legacy data is not used as fallback |
| 21 October 2026 | Separate delivered-work log and full development roadmap | This file and `PROJECT_ROADMAP.md` | Delivered |

## Verification evidence

- `npm test`: 65 tests pass, including evidence validation, signed plan changes, failed/unopened/batched pages, experience/location exclusions, explicit UI actions, replacement uploads and reviewed downloads.
- `npm run test:ui`: isolated Chrome with controlled AI responses passes desktop and 390/320px layouts, AI score ordering, score filters, failure clearing, navigation/reload and real PDF/Word downloads. Report/screenshots: `.qa/ai-search-ui/`.
- Live Codex check used a synthetic four-year Java resume, not the user's personal resume. ChatGPT Plus/included allowance was reported ready; analysis selected Java backend/Spring Boot roles and technical/process keywords; the final run returned 3 accepted source-backed vacancies. Report: `.qa/ai-search-live-report.json`.
- Live Naukri pages remained inaccessible. Accepted results came from other public sources. No login, challenge bypass, application or separately billed API-key call was performed.

## Practical limits

- AI chooses the role and relevance assessments; exact evidence checks do not independently prove that every interpretation is correct. The user should review suggestions.
- A recorded readable page-open and an AI source excerpt are provenance checks, not a guarantee that a vacancy is current or accurately described by its publisher. Listings can expire after a search.
- Search descriptions are treated as summaries. Full-JD import and review remain necessary before tailoring.
- Search currently uses the candidate's analyzed roles, technical/method keywords and total years. Per-skill experience durations and a separate semantic review of the entire resume against every JD are not implemented.
- Search is synchronous with a bounded four-minute AI turn. Progress is a loading state; resumable background tasks and cancellation are future work.
- Search-plan authorization survives server restarts using the ignored `.local/search-signing-key` file. Profiles signed by the older process-only key need one explicit reanalysis after this update.
- Existing local storage remains personal/browser-based. Replacement-resume history/archive policy is awaiting discussion.


## 22 October 2026 ? investigate empty AI results

Confirmed issues and fixes:

- A Baner-only employer filter could hide Pune/Hinjewadi results while the summary incorrectly claimed that AI found zero employers. The UI now displays total employers found and the filtered count separately, offers Show all AI-found employers, and checks every vacancy location before deduplicating employers.
- Saved analysis tokens were signed with a new random key on each server start. A valid saved analysis could therefore fail before web search started after a restart. The signing key now persists in ignored local application data; changed plans still fail verification. Old tokens receive a structured SEARCH_PROFILE_EXPIRED response and an explicit Analyze resume again recovery action.
- Failed-search messages were lost on reload, leaving the same vague empty-state message as a search that had never run. Search status, errors and diagnostics now persist with the resume revision. Interrupted reloads are identified, and no inference is automatically retried.
- Added Search jobs with AI directly in Step 2 and an action from empty results. The employer section links back to the actual search instead of treating an empty shortlist as evidence of a failed search.
- Search details now report actual web calls, readable source pages, proposed/accepted listings and categorized exclusions. Production stores only status/count/error metadata in `.local/last-search-diagnostic.json`; controlled test servers do not overwrite it.
- The live diagnostic distinguishes completed search from actual accepted vacancies. Zero accepted jobs no longer passes its strict live-vacancy acceptance check.

Verification: 65 automated tests pass, including persisted-key reload, changed-plan rejection, expired-profile UI recovery and employer filter counts. Isolated Chrome verifies filtered employer recovery and failed-search messages after reload along with downloads/navigation/mobile checks. Fresh synthetic Java runs retrieved 1 and 3 accepted vacancies respectively; the latter included one Baner result. This confirms live retrieval works for those runs, not the exact cause in the user's saved Chrome session: the browser-control runtime could not start and the screenshot did not include Step 2's status.

A direct synthetic .NET check on 22 October also passed strict live-vacancy acceptance: 1 accepted employer vacancy, 3 actual web-search events, and no discarded proposed listings. Its analyzed profile used 3.8 years, .NET/ASP.NET Core/React roles and technical/process keywords. Naukri remained blocked; another public employer source supplied the accepted result. Final Chrome checks also exercise one employer with multiple job locations.
