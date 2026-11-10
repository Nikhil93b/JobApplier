# Initial project analysis - 15 October 2026

This analysis was completed before modifying application code for the current review. Findings distinguish reproduced behavior, code-path evidence, and items requiring further evidence. No destructive exploitation was attempted.

## Architecture and entry points

The project is a single-user Node.js ES-module application. `npm start` runs `node --watch server.mjs`, bound to `127.0.0.1`. `index.html` checks `/api/health`, then imports `app.js`. The frontend stores candidate data, jobs, drafts and company watches in browser localStorage. There is no application database, account/role system, queue, scheduler, deployment manifest or cloud infrastructure in the inspected project. `profile.example.json` is an example, not an authentication/configuration source.

### Main modules

| Module | Responsibility |
|---|---|
| `server.mjs` | Static-file allowlist, HTTP routes, upload limits, local origin/host checks, errors and health/version |
| `app.js`, `index.html`, `style.css` | Upload, discovery, filtering, shortlisting, review, exports and local persistence |
| `documents.mjs` | Mammoth DOCX parsing, PDF.js extraction, DOCX and PDFKit export |
| `resume.mjs`, `match.mjs`, `pune.mjs` | Rule-based extraction, keyword coverage, evidence, experience/locality filters and search URLs |
| `sources.mjs`, `discovery.mjs` | Dated company research and optional documented Greenhouse connector |
| `naukri.mjs` | Public HTML/JSON-LD, renderer fallback, bounded search/detail caches |
| `naukri-browser.mjs`, `browser.mjs` | Isolated Playwright browser, DOM extraction and access-state classification |
| `codex-ai.mjs` | Local Codex JSON-RPC, ChatGPT Plus/allowance checks, structured AI review, evidence validation |
| `companies.mjs`, `research/` | Checked-in company and role research with provenance; not live search |
| `*.test.mjs`, `browser-flow.mjs` | Unit/API/simulated-DOM tests and optional isolated Chrome workflow |

Configuration: `PORT`, `JOB_APPLIER_BROWSER`, `JOB_APPLIER_CODEX`, `JOB_APPLIER_TEST_RESUME`, and the existing local Codex sign-in. AI subprocesses strip API-key/alternate-endpoint environment variables. The user has authorized Plus-only inference and transmission of resume/JD text to OpenAI. No separately billed fallback is authorized.

## Business workflows and data flow

1. **Resume:** file chooser -> `/api/resume` -> bounded upload -> `readResume` -> `extractProfile` -> UI/localStorage. Resume bytes are not sent to job boards. The source file is not edited.
2. **Research:** upload/reload/refresh -> `/api/discover` -> `discoverJobs` -> checked-in `jobLeads` -> `mergeJobs` -> locality/title/experience/keyword filters. Reloading research is not live discovery.
3. **Naukri:** live button -> POST `/api/naukri` -> profile-field validation -> `naukriSearches` -> public HTML -> JSON-LD or isolated Chrome rendering -> normalized partial jobs/status -> UI/localStorage. A real request currently ends with zero jobs and HTTP 403 from Naukri.
4. **Full JD:** selecting a partial Naukri job -> `/api/naukri/detail` -> official URL validation -> rendered detail page -> description import or manual-entry fallback. Complete descriptions are required before tailoring.
5. **AI:** explicit review button -> local JSON route -> account/allowance check -> ephemeral Codex thread -> structured result and exact-evidence validation -> suggestions. Suggestions never automatically modify the resume.
6. **Draft/export:** original resume + selected JD -> rule-based draft -> optional individual AI edits -> accuracy checkbox -> `/api/export` -> PDF/DOCX download. Editing invalidates approval. Applying happens manually outside the app; opening a link does not mark Applied.
7. **Persistence:** browser localStorage retains the original, selected jobs, limited match cache and draft/review state; JSON export is the user's backup. Clearing local data is consequential and already asks for confirmation.

Entities: candidate profile, source job with provenance/partial flag, selected application/status, resume revision, tailored draft/approval, AI review/evidence and watched company. There are no paid transactions or outbound communications in the application workflow.

## Critical dependencies and operational boundaries

- Naukri must actually expose permitted public results; DOM code cannot repair an upstream access denial.
- Chrome/Edge installation and browser launch permissions are required for rendering.
- Codex executable, ChatGPT Plus authentication, network and included allowance are required for AI.
- Mammoth/PDF.js/DOCX/PDFKit handle untrusted documents; parsing/extraction is in the server process.
- localStorage is browser-specific and can fail or be overwritten by another tab.
- Logging is currently route plus error name; health proves process/version availability, not source readiness. No metrics/tracing/graceful job draining are implemented.

## Top 10 findings, ranked

### 1. High - Live Naukri discovery is not operational

- **Affected:** `naukri.mjs:createNaukriConnector`, `naukri-browser.mjs:createNaukriBrowser`, live UI.
- **Problem/importance:** the central discovery promise fails against the actual source.
- **Reproduce:** POST valid roles/skills/experience to the running `/api/naukri`; on this machine it returns HTTP 200 with `status: blocked`, zero jobs, and a message reporting Naukri HTTP 403.
- **Expected/actual:** real source jobs or explicit operational failure; actual source access is denied.
- **Fix:** do not represent a controlled-page parser pass as live-source success. Use permitted access if available; a user-initiated import from an already viewable Naukri page is a separate conditional option. No stealth, private API, credential copying or challenge bypass.
- **Regression risk:** alternative ingestion must preserve provenance, full-JD gating, deduplication and the Plus-only policy.

### 2. High - Browser acceptance can pass when live collection fails

- **Affected:** `browser-flow.mjs`, report generation.
- **Evidence:** the test records `liveNaukri.status: blocked` and later sets `passed: true`; successful card/JD tests are routed controlled pages.
- **Reproduce:** run browser tests while Naukri returns 403; overall pass remains possible.
- **Expected/actual:** live acceptance must require actual live records; current workflow pass does not establish live collection.
- **Fix:** separate workflow/fixture results from a strict live acceptance result and nonzero failure in an explicit live check.
- **Regression risk:** existing useful offline tests should remain usable and explicitly labeled.

### 3. High - Refreshed full JDs can retain obsolete approved drafts

- **Affected:** `app.js:mergeJobs`, approval/export flow.
- **Evidence:** generic full-description merges overwrite job requirements without invalidating `tailored.approved` or `aiReview`; manual and Naukri-detail imports have separate invalidation logic.
- **Reproduce:** save an approved draft, then merge the same source/sourceId with a changed complete description.
- **Expected/actual:** preserve the old version and require new review; old approval can remain current by resume revision alone.
- **Fix:** centralize job-update invalidation and preserve previous drafts.
- **Regression risk:** metadata-only refreshes and partial research updates must not erase complete user-imported JDs or unnecessarily revoke approval.

### 4. Medium - Overlapping research/live requests can leave controls disabled

- **Affected:** `app.js:discover`, Naukri handler, shared `searchGeneration`.
- **Evidence:** research disables Refresh, but only reenables it when its generation still matches; a later Naukri request increments the same counter and only reenables its own button.
- **Reproduce:** delay research, start Naukri before it finishes, then resolve both.
- **Expected/actual:** both controls recover; Refresh can remain disabled.
- **Fix:** track busy state independently and centralize button state.
- **Regression risk:** preserve stale-response protection across resume uploads.

### 5. Medium - Legitimate job text is misclassified as a security challenge

- **Affected:** `naukri-browser.mjs:naukriPageState`.
- **Reproduced:** status 200, title `Software Developer`, body `Job description: Implement security checks in C# applications.` returns `blocked`.
- **Expected/actual:** legitimate JD content is ready; broad phrase matching rejects it.
- **Fix:** use HTTP status, explicit challenge UI/title and narrowly matched challenge text.
- **Regression risk:** real access-denied, CAPTCHA and rate-limit pages must still be detected.

### 6. Medium - Malformed upstream card fields can abort extraction

- **Affected:** `naukri-browser.mjs:normalizeNaukriCards`, structured detail metadata.
- **Reproduced:** a card with numeric title throws `card.title?.trim is not a function`.
- **Expected/actual:** reject one invalid record and preserve valid cards; the parser throws.
- **Fix:** bound and validate every external field, canonicalize URLs and discard malformed records.
- **Regression risk:** keep valid Unicode titles, fractional experience and legitimate Naukri URLs.

### 7. Medium - Transient busy responses are cached as source results

- **Affected:** Naukri search/detail caches and the renderer's shared `busy` flag.
- **Evidence:** both caches save every result promise, including `status: busy`; distinct concurrent URLs can receive a one-minute cached busy result after the browser is free.
- **Reproduce:** overlap two distinct detail/search requests, then retry the second after the first completes.
- **Expected/actual:** immediate retry once free; cached busy can persist.
- **Fix:** coalesce identical in-flight requests; do not cache busy/transient failures as successful source data.
- **Regression risk:** retain bounded cache size and avoid multiplying external requests.

### 8. Medium - Multiple tabs can overwrite each other's saved work

- **Affected:** `app.js:save`, localStorage initialization.
- **Evidence:** each tab keeps a full private state snapshot and writes it wholesale; there is no storage-event reconciliation or conflict check.
- **Reproduce:** open two tabs, change different application statuses, save the older tab last.
- **Expected/actual:** conflict detection or merging; last full write can discard another tab's changes.
- **Fix:** add revision/conflict handling before shared-state writes. Prefer a separate change after discovery corrections.
- **Regression risk:** preserve original snapshots, approvals and storage-quota recovery.

### 9. Medium - Process-level document parsing lacks an expanded-input budget

- **Affected:** `documents.mjs:readResume`, `/api/resume`.
- **Evidence:** compressed upload bytes and final text are bounded, but DOCX is expanded before a final text limit; no parser time/memory isolation is implemented.
- **Reproduce status:** not destructively tested; resource-exhaustion impact is a code-review concern, not a demonstrated exploit.
- **Expected/actual:** bounded expansion/work; current compressed-byte checks alone do not establish that boundary.
- **Fix:** evaluate ZIP entry/expanded-byte limits and isolate parsing with a timeout before any wider deployment.
- **Regression risk:** do not reject normal image-bearing resumes or break PDF/DOCX fidelity.

### 10. Low - Upload-limit messages are inaccurate outside the resume route

- **Affected:** `server.mjs:body` and JSON endpoints.
- **Reproduced:** a detail JSON request just over 4096 bytes gets HTTP 413 claiming a 10 MB maximum.
- **Expected/actual:** endpoint-appropriate size information; the displayed maximum contradicts the actual limit.
- **Fix:** parameterize the message or report the applied byte limit.
- **Regression risk:** keep the existing resume-specific 10 MB guidance.

## Security, performance and test gaps

Positive controls: loopback binding, static-file allowlist, origin/JSON checks on discovery/AI, official-host job URL validation, no user-cookie scraping, sandboxed isolated browser, explicit AI actions, exact-evidence checks and review-before-download. These do not make the app appropriate for public hosting. There is no multi-user authorization model and no evidence that one is required for its current local scope.

Important gaps: strict live acceptance, conflicting/slow UI operations, changed-JD draft invalidation, malformed upstream schema, busy-cache recovery, multi-tab conflict handling and parser work budgets. Current JSONL server diagnostics lack request IDs/source-stage information. No database/queue authorization tests apply because those components are absent. No evidence warrants an N+1/database-index optimization. External browser launches and repeated job-analysis/rendering are the real cost centers; keep source work bounded and measure before broad refactoring.

## Recommended order of work

1. Correct live-source acceptance and user-facing source status; establish whether results can be viewed in the user's normal browser.
2. Repair reproduced parser/state/cache defects with narrow regressions.
3. If regular browsing works, offer explicit page capture/import as a separately labeled path; verify real source data before calling it operational.
4. Protect draft review when JDs change and recover all busy controls after failures.
5. Re-run automated and browser flows with the supplied resume; distinguish fixture, workflow and real-source evidence.
6. Address multi-tab persistence, parser resource isolation and operational diagnostics before considering wider deployment.

No Critical finding is established by the inspected evidence. Unknown source-feed availability, general real-browser eligibility and deployment requirements remain **not enough evidence yet**.
