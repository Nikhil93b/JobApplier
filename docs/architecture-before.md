# Existing architecture report

Recorded before source migration on 10 November 2026. The repository was inspected directly; no `AGENTS.md` was found in the project or its ancestor directories. This checkout has no Git metadata, so an ignored `.qa/architecture-baseline/` copy and SHA-256 inventory will preserve the original files before moving them.

## Stack and current structure

This application is **vanilla browser JavaScript with a Node HTTP server**, not React. There is no JSX, TypeScript, React router, framework, global-state library, bundler, ESLint configuration, or production-build script. The architecture will be adapted to this stack without adding dependencies or replacing components.

```text
JobApplier/
  index.html                    all existing screen markup and bootstrap
  style.css                     all application styling
  app.js                        1,444-line browser workflow, state and rendering
  server.mjs                    HTTP server, guards, routes and static allowlist
  resume.mjs, documents.mjs      extraction, matching, tailoring, PDF/Word I/O
  ai-job-search.mjs              search policy, schemas, signed plans, validation
  codex-ai.mjs                   Codex transport, account/usage checks, AI orchestration
  pune.mjs, match.mjs            region, experience and skill utilities
  jobs.mjs                      job identity and refresh/draft preservation
  company-priority.mjs           employer recognition and result ordering
  companies.mjs                 retained historical company research
  discovery.mjs, sources.mjs     Greenhouse board import and legacy profile helpers
  naukri*.mjs, browser.mjs        public-page integrations and isolated browser launcher
  *.test.mjs                    65 existing unit/HTTP/DOM checks
  *flow.mjs, check-*-live.mjs     browser and optional external-service checks
  build-browser-helper.mjs       copies reviewed parsers into the extension
  browser-helper/                optional unpacked extension, markup, CSS, parser copies
  docs/history/, research/       retained documentation/research
  package.json, package-lock.json, profile.example.json, .gitignore
  node_modules/                 installed dependencies (untouched)
  .qa/, .local/                 ignored QA output and local persistence (untouched)
```

## Features discovered in source

| Feature | Existing responsibilities and files |
| --- | --- |
| Resume/profile | Explicit upload/save, extraction, correction, revision management, profile rendering; `app.js`, `resume.mjs`, `documents.mjs` |
| AI job search | Explicit analysis, signed search plans, online discovery, source validation, diagnostics, filtering, ranking and pagination; `app.js`, `ai-job-search.mjs`, `codex-ai.mjs` |
| Employers | AI-result employer directory, area/search filters, exports and MNC preference; `app.js`, `company-priority.mjs`, `companies.mjs` |
| Job imports | Manual complete-JD import, Greenhouse boards, Naukri JSON/hash captures and full-JD loading; `app.js`, `discovery.mjs`, `sources.mjs`, Naukri modules and extension |
| Tailoring | Original-fact-preserving draft, review/approval, stale-revision guard, PDF/Word downloads; `app.js`, `resume.mjs`, `documents.mjs` |
| AI review | Optional profile/job review, cited evidence, selective wording application and revision checks; `app.js`, `codex-ai.mjs` |
| Application tracker | Shortlists, application status, retained drafts and tracker JSON export; `app.js`, `jobs.mjs` |

## Routing, state and dependencies

- Browser navigation uses `#profile`, `#jobs`, `#tracker`, `#companies` and `#ai`; `#ai` switches workspaces. `#naukri-import=...` is consumed and removed after staging a capture. No router dependency or lazy route system exists.
- Startup checks `/api/health`, requires API version 3 and imports `/app.js?v=<version>` before enabling upload. Static files are explicitly allowlisted.
- Backend routes are `GET /api/health`, `/api/discover` (retired, 410), `/api/jobs`; `POST /api/resume`, `/api/export`, `/api/naukri`, `/api/naukri/detail`, `/api/ai/status`, `/api/ai/analyze`, `/api/ai/search-profile`, `/api/ai/search-jobs`.
- Browser state is a mutable object persisted under localStorage key `job-applier`. Restore normalizes legacy selections and stale/interrupted searches. Save retains selected/manual jobs plus up to 80 ranked matches. Busy flags, generation counters, pagination and pending files/captures are transient.
- Rendering and handlers in `app.js` mutually call each other through lexical scope. Profile changes reset search authorization context; job changes archive drafts and invalidate AI evidence. These interactions must survive extraction.
- Shared functions include DOM element creation, status messages, safe links, blob downloads, skill matching, geographic/experience matching and job identity/update helpers. There is no existing reusable React component system.
- `resume.mjs` mixes extraction with job-fit/tailoring utilities. `server.mjs` mixes transport, guards, diagnostics, feature handlers and static routing. Browser `fetch` calls are embedded in UI handlers.
- `companies.mjs` and older UI scripts are historical utilities. They are retained, even though fixed research is excluded from current AI discovery results.
- Extension parser copies intentionally duplicate `naukri-page.mjs` and `naukri-capture.mjs`: the unpacked extension needs self-contained files. The existing build/check enforces parity; this duplication will remain intentional.

## Integrations, authentication and configuration

- Codex stdio app-server connection uses the existing ChatGPT Plus account, included-usage guards, evidence schemas, timeouts, disabled command/app/MCP tools, offline analysis and separately enabled hosted web search. There is no application login or client token store.
- Search-plan authorization uses HMAC and the existing `.local/search-signing-key`; search diagnostics remain `.local/last-search-diagnostic.json`. Existing keys/data must not move or be regenerated by this refactor.
- Server POST origin checks and local JSON/Host/Sec-Fetch-Site guards protect AI and Naukri requests. Upload/body limits, status codes and error messages must remain unchanged.
- Greenhouse uses the existing boards API endpoint, timeout and redirect handling. Naukri uses bounded public HTTP requests and an isolated Playwright browser fallback, preserving destination validation, caching and blocked/expired states.
- Resume parsing/export dependencies are `mammoth`, `pdfjs-dist`, `docx`, `pdfkit`; browser integration uses `playwright-core`; DOM tests use `jsdom`. No package or version changes are planned.
- Configuration inputs include `PORT`, `JOB_APPLIER_CODEX`, `JOB_APPLIER_BROWSER`, and optional `JOB_APPLIER_TEST_RESUME`. Existing scripts, configuration and environment behavior will be preserved.
- `index.html` and CSS contain the complete current design/content. No separate application image asset directory or CSS URL references were found. Extension HTML/CSS/assets remain in place.

## Baseline validation and migration plan

- `npm test`: **65/65 passed** outside the filesystem/network sandbox. Initial restricted execution produced local HTTP connection failures; these were environmental, and the unrestricted repeat passed without edits.
- The controlled `npm run test:ui` baseline is being captured separately; sandboxed browser launch was unavailable.
- No configured TypeScript, ESLint, or application production build exists. `npm run build:browser-helper` is the existing distributable preparation step.

Incremental migration order:

1. Move original domain/integration/style files into `src/features`, `src/shared`, `src/services`, `src/styles`; update consumers and keep existing public module URLs through explicit compatibility routes. Validate before continuing.
2. Extract browser state and existing feature handlers/renderers, compose callbacks in `src/app`, and extract endpoint-specific fetch functions. Keep all original markup and rendering logic. Validate browser/DOM behavior.
3. Extract existing HTTP feature handlers behind the central guards and route dispatcher. Preserve dependency injection and every endpoint. Validate APIs and guard/error paths.
4. Check module graph/cycles, all served dependencies, stylesheet bytes, helper parity, preserved config/scripts, and controlled browser desktop/mobile flows. Record limitations and all moved paths in the final report.

No bulk deletion or recreation is planned. Original files will be moved; root `app.js` and `server.mjs` will remain small compatible entry points. Factory composition and explicit callbacks will avoid new module cycles without introducing a state library, framework, empty architectural folders, or UI changes.
