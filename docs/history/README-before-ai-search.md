# Job Applier

Personal job discovery, shortlisting, and resume tailoring app.

This README is the development plan and execution tracker. Update it after each development milestone, recording what changed, what was checked, and any remaining limitations.

Last updated: 18 October 2026.

## Agreed product workflow

1. Choose the original resume and click **Find matching jobs**. File selection alone does not upload, parse or search. No separate skills file or required preference form.
2. Extract a structured candidate profile: contact information, skills, work experience, projects, education, certifications, and relevant preferences. Let the user correct the extraction.
3. Prepare Naukri searches from the uploaded resume's skills, titles and stated experience, with Pune selected and separate Baner, Balewadi and Hinjewadi Phase 1/2/3 keyword searches. Load dated local company job leads for review. The public HTML/browser connector and full-JD importer are implemented; live Naukri access currently returns HTTP 403.
4. Collect job descriptions and source links, remove duplicates, and present relevant jobs for the user to handpick.
5. For each selected job, extract key responsibilities, required and preferred skills, keywords, and phrases. Explain which requirements the candidate meets and which need review.
6. Propose job-specific resume edits using the candidate's actual experience. Show the original text, suggested text, and evidence supporting each change. Ask about missing evidence rather than inventing skills, achievements, employers, certifications, or years of experience.
7. After user review, create a separate tailored resume for that job. Preserve the original resume and associate each version with its job and application.
8. Review the tailored resume and application details, then apply through the employer or job platform and track the outcome.

The first release prepares a job list with a separate reviewed resume for each selected job. The user downloads that resume and applies manually on the website. Assisted form filling and automatic submission belong to a later phase. Better wording and keyword alignment can improve relevance, but cannot guarantee shortlisting.

## Confirmed decisions — 14 October 2026

- **Input and output:** accept PDF and Word resumes; download tailored resumes as PDF and Word (`.docx`). Legacy `.doc` conversion support remains to be evaluated.
- **Resume-only onboarding (latest instruction):** derive skills, roles, contact information, experience statements, location, and recognized resume sections from the uploaded document. Corrections are optional. Do not require additional details or a skills JSON file. Unstated preferences, salary expectations, and exclusions remain unknown, and current address is not used as a hard location filter.
- **Discovery (updated 15 October):** prioritize Naukri, opening resume-derived searches there. Pune is the city target; Baner/Balewadi get priority. Bring selected jobs back by pasting the full job description. Do not label generated search links or research snapshots as live Naukri integration.
- **Location scope (updated 17 October):** retain Baner/Balewadi and add Hinjewadi Phases 1, 2 and 3 to prepared searches, locality priority and saved-job filters. MNC priority remains first, with locality and fit deciding order inside each company group.
- **Usability (18 October):** explicit resume submit followed by three guided steps: add resume, review matches, tailor/apply. Explain filters beside their controls; keep advanced sources and the optional directory collapsed. AI Resume Review has its own screen, accessible from desktop/mobile navigation. Saved results restore on reload without automatically searching. Make no claim that submit retrieves working live Naukri results.
- **Layout:** assess the uploaded resume's readability, section hierarchy, text extraction, and formatting. Preserve a good layout where technically feasible; explain any limitations, particularly with PDF reconstruction, and suggest a cleaner template when needed. Let the user review the suggestion.
- **AI (confirmed 15 October):** ChatGPT Plus only, with no separately billed API fallback. The user authorized sending resume text and job descriptions to OpenAI for analysis. The local Codex connection, Plus account type and included-usage availability were verified.
- **First-release result:** upload resume, browse automatically ranked jobs, then select a job to tailor its resume. The shortlist shows job title, employer, location, source link, relevant keypoints, resume review state, PDF download, Word download, and an Apply link. Download buttons become available only after a reviewed resume version is generated.
- **Applications:** manual submission in the first release; no automated submission or website login handling in this phase.

## Naukri public HTML and browser connector

The **Check automated Naukri access** button posts only roles, skills and experience to `/api/naukri`. The server tries public HTML, then renders an otherwise empty results shell using Playwright and installed Chrome. It reads up to 20 public cards from the first results page, retaining title, company, location, experience and partial-description provenance. Selecting a partial automatically collected lead requests `/api/naukri/detail` to read the complete JD before tailoring. Failed imports open manual entry; saved jobs and prior drafts remain intact. **This automated route currently fails against real Naukri with HTTP 403 and must not be described as working live discovery.**

### Import from a page you can already view

The local [browser helper](browser-helper/README.md) is an alternative, conditional path. If Naukri opens normally in the user's regular Chrome/Edge browser, the user can explicitly capture a results page or full JD, then preview and confirm import in Job Applier. It reads job fields from the chosen page without reading credentials, cookies, forms or the resume. The helper requests only `activeTab` and `scripting`, with no persistent all-sites access or background crawling. It is prepared locally; it has not been installed into the user's regular browser or verified against a real viewable Naukri page.

Run `npm run build:browser-helper`, then follow its setup instructions. Captures transfer via a URL fragment that is removed before preview and is not sent to the server, or through a locally downloaded capture JSON. Captures are size/type/URL checked, unexpected approval fields are discarded, Unicode is preserved and imports require confirmation. Exact Naukri URLs update existing jobs. A changed JD archives old drafts and clears current approval/AI review. Partial captures require a separate full-JD capture or manual description entry.

Install Chrome, or set `JOB_APPLIER_BROWSER=msedge` for installed Edge. The connector uses a temporary, isolated, headless browser with Chromium sandboxing enabled. It does not use your daily browser profile, saved login or existing cookies. No resume text is sent to Naukri. HTML requests have an 18-second timeout and 3 MB cap; browser navigation and rendering waits are limited to 25 and 15 seconds. One browser collection runs at a time. Search/detail requests have bounded one-minute caches. Job URLs are restricted to HTTPS Naukri job-listings paths; cross-site document navigation is blocked.

Live verification on 15 October returned an HTTP 200 HTML shell followed by **HTTP 403 Access Denied in real Chrome**. A second public search URL was also denied. The renderer and full-JD importer pass controlled browser tests, but live vacancy ingestion remains blocked by Naukri source access and is not verified as working. Blocked, expired, empty and unrecognized-page states are distinguished. No stealth, private API, proxy rotation, cookie extraction or challenge bypass is implemented.

AI review is now implemented through the local Codex app server using its managed ChatGPT sign-in. It identifies resume facts, explains job-fit gaps, and proposes wording changes citing exact original resume evidence. Suggestions require user review. No separately billed API integration is configured.

## First-time use

1. In **Step 1**, choose your PDF, Word `.docx` or text resume and click **Find matching jobs**. Processing starts only after submit. A selected replacement leaves the saved resume and its results intact until submitted successfully. A bad replacement leaves them available.
2. **Step 2** shows matches from saved/imported jobs and dated local research. Common filters are visible, with descriptions that change with the selected option. More filters includes skill coverage, relevant/all/shortlisted jobs, title matching and experience. MNCs-first includes other employers; MNC-only excludes them. A minimum coverage above zero hides partial/unscored descriptions. Reset filters restores the recommended view; an empty list also offers Show all saved jobs to remove restrictions.
3. To add current openings, choose **Find jobs on Naukri** and follow the three instructions: open an area search, copy a selected job's complete details, and choose **Add a job description**. Browser-helper setup/import is optional. Automatic Naukri and research reload are under **Other source options**; blocked access gets a friendly next action with connection details kept separately.
4. Shortlist a job or choose **Select & tailor resume**. **Step 3** holds the shortlist, reviewed PDF/Word downloads and application tracking. The company directory is optional below it. Open **AI Resume Review** in the sidebar or top navigation for a separate screen containing the latest review for your submitted resume. Use **Back to job matches** to return; switching screens preserves the current filters and does not start AI analysis. No application is submitted automatically.

## Location targeting

The job list targets Pune, prioritizing **Baner, Balewadi and Hinjewadi Phases 1, 2 and 3** within each company-priority group. Six resume-derived Naukri search links cover those five areas plus Pune. Location options include all target areas, Baner/Balewadi only, all Hinjewadi, and each Hinjewadi phase separately. The existing company directory remains the dated Baner/Balewadi research snapshot.

Location matching recognizes Hinjewadi, Hinjawadi and the entered spelling Hijewadi, numeric/Roman phases, and multiple explicitly listed locations. Phase filters require a stated phase in the job's location field; a description mentioning an office is insufficient. Generic Hinjewadi listings remain in broader Hinjewadi, target-area and Pune views without being assigned a phase. Prepared links use locality keywords; check Naukri's location filters after opening them.

## Company priority

Jobs default to **MNCs first, then other companies**. The **Company priority** dropdown also offers **Major MNCs only**, **Other / unclassified companies only**, and **All companies by match**. The choice persists in the browser. Existing location, title, experience, skill coverage, search and shortlist filters still apply; nearby jobs and resume fit decide order within each company group. The preference applies to jobs collected or imported into this app, not results on Naukri's own website.

The expandable **Companies included in MNC priority** list links to the official company sources for 20 curated major employers, including TCS, Infosys, Accenture, Capgemini, Cognizant, Wipro, HCLTech, IBM, Tech Mahindra, Persistent Systems, EPAM, NTT DATA, Microsoft, Google, Amazon, Oracle, SAP, Salesforce, Deloitte and Dell. This is a preference list, not a complete register of multinational businesses or an employer-quality ranking. Matching uses recognized employer names/aliases and common legal suffixes. A recruiter mentioning an MNC client is not classified as that MNC. Unrecognized names stay **Other / unclassified**. These filters do not create new vacancies or resolve the automated Naukri access failure.

## ChatGPT Plus integration

The app connects to a local `codex app-server` process using the documented JSON-RPC interface. Codex manages its own ChatGPT sign-in; the app does not read credential files or copy this chat's session tokens. On Windows the installed desktop Codex executable is detected under LocalAppData. Elsewhere install Codex CLI, or set `JOB_APPLIER_CODEX` to the executable path before starting the server. Sign in using `codex login` if needed.

Open **AI Resume Review** from the sidebar, top navigation or submitted-resume shortcut. This separate `#ai` screen shows the latest saved review for the current resume; direct links and reloads restore it without making an AI request. If no resume has been submitted, the screen links back to Step 1 and disables analysis. Choose **Check ChatGPT connection**, then **Analyze resume with AI** to intentionally request a review. Use **Back to job matches** to return without resetting filters. In a selected job's review dialog choose **Get AI job-fit & wording suggestions** after importing its complete description. Analysis never automatically changes the resume. Each suggested edit shows original wording, proposed wording, its reason and an exact evidence quote. Choosing **Use this wording in my draft** applies one unambiguous replacement and clears approval; the original resume stays separate.

Each analysis requires Codex to report a ChatGPT Plus account and `ordinaryUsageAllowed: true`. Exhausted or unknown included usage pauses requests. The child process strips API-key and alternate endpoint environment variables, forces ChatGPT authentication with the built-in OpenAI provider, uses standard speed, and has no paid-provider fallback. No credit purchases, allowance resets, scheduled requests or automatic retries are performed. Usage shares the user's Codex/ChatGPT allowance; a preflight check is not a reservation of that allowance.

AI requests use ephemeral read-only threads, disable shell tools, web search and configured app/MCP integrations, and return validated JSON. Only one analysis runs at a time, with a two-minute timeout. Invalid evidence, failed turns and interrupted turns never produce an accepted analysis. Unit/UI tests mock inference and spend no allowance. The opt-in real-browser test completed actual Plus resume and job-fit reviews with the user's resume on 15 October. Desktop/mobile screenshots and both exported PDF pages were visually inspected; Word output was parsed back successfully.

References checked on 15 October 2026:
- [Codex authentication](https://learn.chatgpt.com/docs/auth)
- [Codex app server protocol](https://learn.chatgpt.com/docs/app-server)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Sign in with ChatGPT quickstart](https://developers.openai.com/siwc/quickstart) (a separate registration-based integration; not used by this local connector)

## Remaining implementation decisions

- Real live Naukri collection remains unresolved: the isolated browser receives HTTP 403. Verify whether ordinary user browsing is allowed before claiming the prepared page-import helper works with real source data. Maintain the confirmed subscription-only AI policy; do not add an API-key fallback.
- Obtain the resume when running the workflow. Additional preferences are not required; leave absent information unknown.
- Start with on-demand discovery; scheduling and application automation are future enhancements.

## Pune focus and company research — 15 October 2026

- Target profile supplied for research: full-stack developer, **3.8 years stated**, C#/.NET, ASP.NET Core, React, SQL Server, Azure and AWS. Personal contact details are not included in search URLs or the company report; actual app searches use the uploaded resume.
- Job search city: **Pune**; Baner/Balewadi prioritized. The job list defaults to Pune with those areas first; a local-only option is available.
- Company directory scope: **Baner and Balewadi only**. The user explicitly accepted fewer than 100 verified companies rather than widening geography. This research pass contains **42 sourced entries: 32 Baner and 10 Balewadi**, and **8 job leads**. This is not a claim of 42 matching vacancies or a definitive quality ranking.
- The directory preserves company location evidence, source URLs, check dates, and separate hiring states: roles listed, indexed listing unconfirmed, careers portal, accepts profiles, location only, past recruitment event, or explicitly no openings.
- The [research report](research/baner-balewadi-companies.md) contains the full directory and source links. Export the directory from the UI; company watch state persists locally.
- Naukri public pages and indexed vacancy retrieval were unavailable in this research session. The working feature is **prefilled external search plus manual selected-job import**, not live vacancy ingestion. Review Naukri's own filters after opening the search; its pages/parameter handling were not visually verified.
- Decimal experience is retained as stated: 3.8 is not interpreted as 3 years 8 months. The generated Naukri URL uses a whole-year parameter of 3, and the app displays both values. Jobs are screened against recognized ranges/minimums where stated; unknown requirements remain visible for review. Specialist technology experience is not inferred from total tenure.
- Broader worldwide boards are no longer fetched automatically. Previously saved jobs remain available, but the location filter excludes non-Pune entries by default. The optional individual Greenhouse import remains supported.
- Research snapshots are explicitly labeled **Partial JD**. Import a complete job description before tailoring; do not calculate a full-description percentage from a short research overview. Missing Node.js, PHP/Laravel or specialist requirements must be reviewed even when years overlap.

## Development plan

Statuses: **Done** means implemented; **Partial** means an initial version exists; **Planned** means not implemented; **Decision needed** means the approach depends on user input or source access.

| Phase | Deliverable | Status | Acceptance criteria / next work |
| --- | --- | --- | --- |
| 0. Local foundation | App server, accessible workflow, profile and tracker storage | Done | Local app starts with `npm start`; existing data persists in the same browser. |
| 1. Resume ingestion | PDF/Word upload, extracted profile, optional corrections | Partial | PDF, .docx and text parsing implemented; recognized skills/roles, contact fields, explicit experience/location, and recognized sections extracted. On-demand AI resume review is implemented; broader structured extraction and OCR remain planned. |
| 2. Resume-derived matching | Skills, title, decimal experience, Pune locality | Done | Full-stack titles and .NET/ASP.NET Core/SQL Server recognized; title and experience filters enabled; unknown experience requirements stay reviewable. No required profile form. |
| 3. Job discovery | Naukri-guided search and local company research | Partial | Resume-derived external Naukri searches, 42-company local directory and 8 dated leads implemented. Public HTML/browser collection and full-JD retrieval are implemented; live access returns HTTP 403. Google integration remains unimplemented. |
| 4. Handpicked shortlist | Job detail review, save/reject shortlist, duplicate handling, availability checks | Partial | Job list, descriptions, and URL deduplication exist. Add explicit shortlisted/rejected states and availability checks. |
| 5. Job analysis | Required/preferred keywords, responsibilities, evidence mapping, gaps | Partial | Keyword coverage plus on-demand AI job-fit gaps, questions and evidence-linked suggestions exist. More complete structured required/preferred requirement extraction remains planned. |
| 6. Resume tailoring | Job-specific keypoints and editable resume drafts | Partial | Matching/missing keywords and evidence lines shown; existing inline skills lists reordered; full original text retained for comparison; edits saved separately. AI job-fit review and before/after wording suggestions with exact evidence are implemented; each chosen edit clears approval. |
| 7. Resume export | Original text retained; per-job PDF/Word download | Partial | Reviewed drafts download as PDF and .docx in a clean text layout. Original uploaded layout preservation remains planned. Format round trips verified; sample PDF visually inspected; Word rendering unavailable. |
| 8. Manual application preparation | Per-job approved PDF/Word downloads and employer application link | Partial | Draft text and employer-form links exist. Add per-job resume review and downloads; never mark Applied solely because a link was opened. Automation is deferred. |
| 9. Tracking | Application history, resume version, submission date, outcome | Partial | Manual status tracker and JSON export exist. Add version association, dates, and confirmed submission history. |
| 10. Verification and delivery | Workflow checks, extraction quality, document QA, setup guide | Partial | Forty-one tests pass with the actual resume. A real Chrome run verifies upload, filtering, live Plus resume/job reviews, controlled browser-card/full-JD collection, approval gating, PDF/Word downloads, tracking, persistence and bad-file recovery. Desktop/mobile screenshots and both PDF pages were inspected. Live Naukri returns HTTP 403; Word visual rendering remains unavailable. |

### Intended implementation order

1. Keep the upload-only and manual-application scope; verify supported subscription-backed AI and automated Naukri discovery access.
2. Improve resume extraction quality and keep profile corrections optional.
3. Add discovery for the chosen sources and a handpicked shortlist.
4. Add per-job analysis and evidence-backed resume suggestions.
5. Add approved resume versions and verified document exports.
6. Present each selected job alongside its approved PDF/Word resume and application link; complete manual tracking.

### Later phase

Add supported automatic Naukri vacancy collection and Google discovery, optional scheduled searches, and assisted application automation after the document-preparation workflow is reliable and the user requests it.

### Proposed data records (not yet implemented)

- **Candidate profile:** original resume reference, extracted information, user corrections, additional verified skills, and job preferences.
- **Job:** source, source identifier, canonical application URL, company, title, description, location, dates, requirements, and shortlist decision.
- **Tailoring proposal:** job reference, keyword, profile evidence, original text, proposed text, and review decision.
- **Resume version:** original resume reference, job reference, approved edits, generated document, and creation date.
- **Application:** job reference, resume version, review status, submission confirmation, dates, and hiring outcome.

## Executed work

| Recorded date | Work completed | Validation / limitation |
| --- | --- | --- |
| 13 October 2026 | Created dependency-free Node.js local server and resume/job/application UI. | JavaScript syntax checks passed. |
| 13 October 2026 | Added text resume upload, recognized skill extraction, custom skills, matching, editable application drafts, and local storage. | Three matching/link tests passed. This is keyword coverage, not full resume analysis. |
| 13 October 2026 | Added JSON skills/roles import, target role/location filters, Greenhouse company-board discovery, job descriptions, duplicate refresh, and saved draft edits. | Seven tests passed in total; live fetch returned 21 openings; invalid board input returned HTTP 400. Browser connection was unavailable, so visual QA was not completed. |
| 14 October 2026 | Recorded the clarified product workflow, development roadmap, current implementation status, and open decisions in this README. | Documentation change only; Google/Naukri search, structured PDF/Word extraction, and tailored resume generation are not implemented. |
| 14 October 2026 | Recorded PDF/Word input/output, full preference collection, layout assessment, subscription-first AI investigation, and manual applications with per-job resume downloads. Checked official OpenAI authentication and plan-usage documentation. | Planning/documentation only. No AI account integration, search provider, resume parsing, or document exports implemented in this update. |
| 14 October 2026 | Implemented resume-only onboarding, PDF/.docx parsing, profile extraction, automatic multi-board fetching, ranked jobs, shortlist, selection-based tailoring, review gating, and PDF/.docx downloads. Added file libraries and a dependency lockfile; removed required skills/role forms. | Fourteen tests passed, including document round trips and the local HTTP upload/export flow. Live boards checked; sample PDF rendered and visually inspected. AI rewriting, Google/Naukri, scanned-PDF OCR, and original layout preservation remain unimplemented. Browser and Word visual QA unavailable. |
| 15 October 2026 | Replaced default global fetching with Pune-focused Naukri search preparation, title/experience/location filters, local company directory/watchlist, dated role leads, and full-description import before tailoring. Added `pune.mjs`, `companies.mjs`, `pune.test.mjs`, and the sourced company report; updated UI and .NET-related extraction. | Nineteen tests passed and JavaScript syntax checked. Directory has 42 area-specific entries and 8 review leads. Automated Naukri ingestion is unavailable; external links and dated research are labeled accordingly. Browser UI verification remains unavailable. |
| 15 October 2026 | Reproduced the failed upload against the running app: outdated server returned 404 for `/pune.mjs` and `/companies.mjs`, preventing client initialization. Added API health/version checks and visible startup errors, enabled server watch mode, and restarted the stale process. Fixed spaced-colon section headings, inline addresses, and labeled experience estimates from employment dates. | Tested `Nikhil_SoftwareDev (1).docx` directly and through the local API. Twenty-five tests pass, including production UI event handling in a simulated DOM, bad-file recovery, job import, approval and PDF/Word downloads. Live port-3000 checks confirm all client modules load, upload returns HTTP 200, research returns 8 leads and both export formats work. Real browser visual inspection remains unavailable. |

### Future execution log entries

| 15 October 2026 | Added subscription-only AI resume review and job-fit suggestions through local Codex, exact evidence validation, per-suggestion draft edits and review gating. User confirmed Plus, no separately billed APIs, and consent to send resume/JD text. | Thirty-five tests pass. Live account read confirmed ChatGPT Plus with included usage available; one synthetic resume analysis completed. Naukri browser rendering and real-browser visual checks remain unfinished. |

| 15 October 2026 | Added isolated Chrome/Edge Naukri rendering, card normalization, complete-JD retrieval, blocked/expired/empty handling and local-request protection. Added opt-in browser workflow tests using the previously supplied resume. | Forty-one automated tests pass with the actual resume. Real Chrome flow passed with live Plus resume/job reviews, PDF/Word downloads, tracking, persistence, invalid-file recovery and unchanged original-file hash. Controlled rendering/full-JD pages pass. Live Naukri returns HTTP 403 Access Denied. Desktop/mobile screenshots and both PDF pages inspected; Word visual rendering unavailable. |

| 16 October 2026 | Completed initial architecture/ranked-risk review before code changes; corrected source acceptance, parser/schema/cache handling, discovery controls and changed-JD approval. Prepared explicit browser-page capture/import helper with limited permissions. | 51 tests pass with the supplied resume. Full isolated Chrome workflow passes with live-source status explicitly failed; helper popup/transfer/import flow passes using controlled pages and simulated extension APIs. Strict real-source acceptance fails with HTTP 403 and zero jobs. Helper is not installed in the user's regular browser; real browser capture remains unverified. See PROJECT_REVIEW.md and REVIEW_RESULTS.md. |

| 17 October 2026 | Added persistent company priority: major MNCs first by default, MNC-only, other/unclassified-only, and match order. Added an expandable sourced preference list of 20 employers, conservative alias matching, company badges and MNC-aware job-cache retention. | 54 tests pass with the supplied Word resume. Isolated Chrome verifies all modes, preference persistence after reload, preservation of hidden jobs, no JavaScript errors, and desktop/mobile layout. Ordering uses controlled imported job records, not real Naukri retrieval. Existing match/location filters still apply; automated Naukri access remains unresolved. |

| 17 October 2026 | Added Hinjewadi Phases 1, 2 and 3 to target localities and prepared Naukri searches, plus individual phase, all-Hinjewadi and target-area filters. Added spelling/Roman-numeral recognition and explicit multi-location matching; retained Baner/Balewadi filtering and MNC-first order. | 57 tests pass with the supplied Word resume. Isolated Chrome verifies six prepared links, all phase filters, combined MNC/location filters, unknown-phase behavior and desktop/mobile layout without JavaScript errors. Tests use controlled job imports; no new live vacancy retrieval is claimed. Company-directory research remains Baner/Balewadi only. |

| 18 October 2026 | Reworked UI into three guided steps with explicit Find matching jobs submit, filename/readiness/loading/error states, automatic results focus, visible dynamic filter descriptions, active-filter summaries, reset/show-all recovery, partial-JD warnings, guided Naukri/manual import, and optional helper/AI/directory/source panels. Reload restores saved results without automatic discovery. | 57 tests pass using the supplied Word resume, including extended production UI checks for submit gating and filter recovery. New `npm run test:ui` verifies the flow in isolated Chrome, actual reviewed PDF/Word downloads, bad-file recovery, preserved original resume, no automatic AI requests, controlled source-failure guidance, and 390/320px mobile layouts. Helper transfer/import tests pass on controlled pages. Source access remains unresolved; these tests do not establish live Naukri ingestion. |

| 18 October 2026 | Moved AI Resume Review to a separate screen with sidebar/top navigation, a submitted-resume shortcut, current-resume/review context, an empty-state prompt and a Back to job matches link. Long reports are absent from the job-search screen; saved reviews and in-session filters remain intact when switching views. | 57 tests pass with the supplied resume. Chrome UI checks verify desktop/mobile navigation, saved-review reload using a controlled fixture, preserved job filters and zero automatic AI requests. Browser-helper transfer/import checks still pass on controlled pages. No live inference was needed for this layout change. |

Append a row with date, deliverable, files affected where useful, verification performed, and outstanding limitations. Change a phase to Done only after its acceptance criteria are met. Record blockers and user decisions here so future work can resume without losing context.

## Run

Requires Node.js 22.14 or later. Run `npm install` once (dependencies are already installed in the current workspace), then `npm start`, and open http://localhost:3000. `npm start` now watches server files and restarts after changes. Use `npm run start:once` when watch mode is not desired. An optional `PORT` environment variable selects another port.

If the page reports an outdated server, stop the previous server with Ctrl+C, run `npm start` again, and refresh. The page checks `/api/health` before enabling uploads so an incompatible backend cannot silently leave the controls inactive.

Run `npm test` to check matching, extraction, document parsing/exports, validation, served browser modules and the production UI workflow in a simulated DOM. To exercise that workflow with a real local Word file instead of the generated fixture, set the PowerShell environment variable `JOB_APPLIER_TEST_RESUME` to its full path before running `npm test`. The test reads the document in memory and does not copy it into the repository. These tests do not replace visual checks in a real browser.

Run `npm run test:ui` with `JOB_APPLIER_TEST_RESUME` set to verify the guided submit/filter/import/download workflow in isolated Chrome. It uses controlled job/source records, makes no AI requests or applications, checks the original file hash, and saves a report/screenshots under ignored `.qa/usability-test/`. No live Naukri availability is claimed by this test.

For an isolated real Chrome test, set `JOB_APPLIER_TEST_RESUME` and run `npm run test:browser`. This attempts live Naukri and uses controlled pages to verify successful browser rendering/full-JD retrieval; AI is mocked. Use `npm run test:browser:live-ai` to intentionally use included Plus allowance for two actual reviews. Neither mode submits applications. Reports, screenshots and downloaded QA artifacts are saved under ignored `.qa/browser-test/`; they contain resume information and are not production application documents.

Browser reports now separate `workflowPassed` from `liveNaukriPassed`, with overall status `partial-live-source-unavailable` when the source fails. `npm run test:naukri:live` is the strict acceptance check: it exits nonzero unless real Naukri records and a complete JD are retrieved. It currently fails with HTTP 403 and zero records. `npm run test:browser-helper` tests actual popup/transfer/import code with controlled pages and simulated Chrome extension APIs; that passing test does not verify ordinary live Naukri access.

The initial architecture/security/reliability analysis and ranked issues are in [PROJECT_REVIEW.md](PROJECT_REVIEW.md). The current change/validation report is in [REVIEW_RESULTS.md](REVIEW_RESULTS.md).

## Current workflow

1. Choose a text-based PDF, Word `.docx`, or `.txt` resume, up to 10 MB, then click **Find matching jobs**. Convert legacy `.doc` files to `.docx` first. Scanned PDFs without readable text need OCR and are not supported yet.
2. After submit, profile extraction, Naukri search preparation and local research matching run, then focus moves to Step 2 results. Optionally correct extracted name, roles or experience. No other upload or mandatory personal-details form is needed. Restoring saved state on page reload does not automatically refetch research or send the resume again.

   Recognized work date ranges can supply an approximate experience total when none is explicitly stated. Estimates merge overlapping jobs and use only the work-experience section, excluding education. They are labeled for review; a role marked Current/Present is taken from the document and is not independently verified. Unrecognized skill spellings are flagged rather than silently added.
3. Open prepared Baner, Balewadi, Hinjewadi Phase 1/2/3 or Pune Naukri searches. Review results there and choose **Import a selected job** to save its full description. Browse local research leads and the company directory; use the linked location/recruitment evidence, and watch companies of interest. Location/title/experience filters apply to saved jobs; missing requirements do not confirm eligibility.
4. Select a job and choose **Select & tailor resume**. A partial Naukri lead first attempts automatic full-JD retrieval. If blocked, or for partial research leads, paste the complete description before tailoring. Review matching keywords, missing requirements, and original evidence, then edit the job-specific resume. Initial tailoring reorders recognized inline skills lists. Optionally request AI suggestions, compare their evidence and choose individual edits to apply.
5. Confirm accuracy, then download PDF or Word. Editing again revokes approval. Uploading another original marks earlier tailored versions as requiring regeneration before download.
6. Apply manually through the job link and update the shortlist's application status. Opening a link does not mark it Applied.
7. Optionally add a job description or another Greenhouse board through the collapsed advanced controls.

The app sends uploaded resume bytes to the local Node server for parsing in memory; it does not write uploads to disk or send the resume to career boards. Choosing an AI review sends extracted resume text and, for a selected job, its complete description to OpenAI through local Codex. AI review results persist with their resume revision in browser local storage. Naukri search links contain role/skill/location/experience terms only. The original extracted text, profile, selected/manual jobs, tailored drafts, company watchlist, and up to 80 recent matching jobs persist in browser local storage. Old tailored versions are retained when an imported job description changes. Exported trackers include tailored text and original text snapshots. Clear local data from the footer.

Loading researched local jobs reloads the checked-in snapshot; it does not crawl new openings. Research leads use source identifiers so multiple jobs on one career page remain distinct. Full imported descriptions survive snapshot reloads. Saved jobs are retained and must be checked for availability. There are no automated submissions or separately billed API-key calls. AI requests run only when the user chooses an AI review. Matching measures recognized keyword coverage, approximate title overlap, and parsed experience requirements, not hiring probability. Applications are submitted manually after review; opening a link never marks a job Applied.

## Current limitations and source reference

Reliable automatic Google/Naukri discovery, OCR, more complete structured extraction, original layout preservation, scheduled searches, and application automation remain planned. AI resume review and evidence-backed wording suggestions are implemented through the user's local ChatGPT Plus sign-in. Naukri external search preparation and selected-job import are implemented. The optional live company-board connector uses the documented [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html); document processing uses [Mammoth](https://github.com/mwilliamson/mammoth.js), [PDF.js](https://mozilla.github.io/pdf.js/examples/), [docx](https://docx.js.org/), and [PDFKit](https://pdfkit.org/docs/text.html). Company-specific sources and hiring qualifications are recorded in the [research report](research/baner-balewadi-companies.md).


### Resume-dependent matching update ? 18 October 2026

Removed Search within results. Successful replacement uploads reset job filters, refresh the company directory and clear the previous resume AI review. Resume extraction prioritizes Java/.NET role searches from recognized stack evidence and retains technical and delivery-process keywords (including Agile/Scrum), excluding generic soft/business skills. Job results require current-profile relevance even in the broad saved-jobs view; explicit incompatible stack titles are excluded. No job cards or company suggestions appear without a submitted/saved resume. Company suggestions are filtered by recorded technical overlap from the dated research snapshot; this does not discover new companies or verify current vacancies. Live Naukri access remains subject to the documented source block.

Validation: all 58 automated tests pass, including a real HTTP/DOM workflow that replaces a Word resume with a Java text resume, verifies refreshed searches/company suggestions/filter reset, and confirms incompatible .NET job titles disappear. Real-browser visual checks and live Naukri retrieval were not run for this change.
