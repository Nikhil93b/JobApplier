# Feature-based architecture migration

Completed on 10 November 2026. This is an architectural migration of the existing vanilla JavaScript/Node application. It introduces no React conversion, framework, router, state library, bundler or dependency changes. The [existing architecture report](architecture-before.md) was written before source migration.

## Original structure

The application previously kept its browser controller (`app.js`, 1,445 lines), HTTP server (`server.mjs`), stylesheet and 16 domain/integration modules in the repository root. Browser state restoration, persistence, rendering, eight fetch calls and event binding shared one lexical scope. HTTP guards, body parsing, diagnostics, static serving and every API endpoint lived together in the server. Tests, browser flows, the extension, documentation, research and package configuration were also present. The complete original layout and dependency analysis are in the pre-migration report.

## New structure

```text
JobApplier/
  app.js                              compatible browser entry
  server.mjs                          compatible CLI and server exports
  index.html                          original markup/bootstrap, unchanged
  package.json, package-lock.json      unchanged scripts/dependencies
  *.test.mjs                          existing tests plus cross-feature regression
  *flow.mjs, check-*-live.mjs           existing check commands, updated imports
  build-browser-helper.mjs             same command, canonical parser source paths
  browser-helper/                     unchanged self-contained extension
  docs/, research/                    retained documentation and content
  src/
    app/
      app.js                          composition and original initialization
      controls.js                     shared action/busy-state coordination
      server.mjs                      HTTP boundary, guards, health, error handling
      store/state.js                  original state restore/save policy
      routes/
        workspace.js                  original hash navigation
        api.mjs                       feature API dispatcher
        static.mjs                    explicit public allowlist and legacy aliases
    features/
      resume/
        components/resume-profile.js
        services/{documents.mjs,resume-api.js}
        routes/resume-routes.mjs
        utils/resume.mjs
      job-search/
        components/job-search.js
        services/{ai-job-search.mjs,job-search-api.js}
        routes/job-search-routes.mjs
      employers/
        components/employers.js
        constants/companies.mjs
        utils/company-priority.mjs
      job-import/
        components/job-import.js
        services/{sources.mjs,job-import-api.js}
        routes/job-import-routes.mjs
        utils/discovery.mjs
      tailoring/
        components/tailoring.js
        services/tailoring-api.js
        utils/tailor-resume.mjs
      ai-review/
        components/ai-review.js
        services/ai-review-api.js
        routes/ai-review-routes.mjs
      application-tracker/
        components/application-tracker.js
    shared/utils/{dom.js,match.mjs,pune.mjs,jobs.mjs}
    services/
      api/{http.mjs,search-diagnostics.mjs}
      integrations/
        codex-ai.mjs
        browser.mjs
        naukri/{naukri.mjs,naukri-browser.mjs,naukri-page.mjs,naukri-capture.mjs}
    styles/style.css
```

No empty `hooks`, `types`, `pages`, `providers`, `assets` or layout folders were added. This project has no React hooks/types or separate page components, and its existing page markup stays intact in `index.html`.

## Original files moved

Original files were moved with filesystem renames before extracting their existing responsibilities. No original file/content was discarded. Root browser/server entries were retained as small compatible adapters. Files not listed here remain in place; tests and standalone check scripts received the required import/path updates.

| Original path | New location |
| --- | --- |
| `app.js` | `src/app/app.js`; existing functions/handlers distributed into the feature components, store, controls, workspace routes and DOM utilities shown above; root `app.js` imports the composition module |
| `server.mjs` | `src/app/server.mjs`; existing route blocks distributed into feature route modules, static/API dispatch and HTTP/diagnostic helpers; root `server.mjs` preserves CLI startup and exported `createAppServer`, `appVersion`, `apiVersion` |
| `style.css` | `src/styles/style.css` |
| `resume.mjs` | `src/features/resume/utils/resume.mjs`; original `jobAnalysis`/`tailorResume` functions extracted unchanged to `src/features/tailoring/utils/tailor-resume.mjs` and re-exported from `resume.mjs` |
| `documents.mjs` | `src/features/resume/services/documents.mjs` |
| `ai-job-search.mjs` | `src/features/job-search/services/ai-job-search.mjs` |
| `company-priority.mjs` | `src/features/employers/utils/company-priority.mjs` |
| `companies.mjs` | `src/features/employers/constants/companies.mjs` |
| `discovery.mjs` | `src/features/job-import/utils/discovery.mjs` |
| `sources.mjs` | `src/features/job-import/services/sources.mjs` |
| `match.mjs` | `src/shared/utils/match.mjs` |
| `pune.mjs` | `src/shared/utils/pune.mjs` |
| `jobs.mjs` | `src/shared/utils/jobs.mjs` |
| `codex-ai.mjs` | `src/services/integrations/codex-ai.mjs` |
| `browser.mjs` | `src/services/integrations/browser.mjs` |
| `naukri.mjs` | `src/services/integrations/naukri/naukri.mjs` |
| `naukri-browser.mjs` | `src/services/integrations/naukri/naukri-browser.mjs` |
| `naukri-page.mjs` | `src/services/integrations/naukri/naukri-page.mjs` |
| `naukri-capture.mjs` | `src/services/integrations/naukri/naukri-capture.mjs` |

## Feature ownership and shared code

The seven feature factories contain the original DOM renderers and event handlers, preserving their function names and behavior. Feature modules expose their existing operations and a `bindEvents` method. `src/app/app.js` composes explicit callbacks for interactions such as search-to-tracker rendering, partial-JD-to-import, tailoring-to-review and review-to-approval. Controllers do not import one another, avoiding circular module dependencies.

- **Resume** owns upload/save, profile correction/extraction, resume revision resets and document parsing/export. **Tailoring** owns draft generation, review/approval and download orchestration; it uses the same backend document exporter.
- **Job search** owns analysis/search actions, signed search policy, current-result selection, diagnostics, filtering, ranking and pagination. **Employers** owns the AI-result employer list, filters/exports, historical research data and employer recognition/order helpers.
- **Job import** owns manual complete descriptions, Greenhouse imports, Naukri full-JD loading, captured-page staging/confirmation and capture-fragment consumption. External Naukri transport/parser modules remain together under integrations because both the server and standalone browser extension use them.
- **AI review** owns optional profile/job reviews and evidence-backed wording application. **Application tracker** owns shortlist/status rendering and tracker export.
- **Shared utilities** retain safe skill/URL matching, Pune/experience matching, job identity/refresh semantics, DOM creation/status/link helpers, HTML-to-text cleanup and blob downloading. No duplicate UI components were generated.

## Services and API routes

The eight browser fetch expressions moved into five feature API modules. They return the original `Response`; feature handlers keep their original success/error handling and concurrency/revision checks. Endpoints, methods, payload fields, request headers, timeouts and messages remain unchanged. There was no existing common browser API client/interceptor to replace.

| Method and path | Owner |
| --- | --- |
| `GET /api/health` | Application HTTP boundary |
| `GET /api/discover` | Job search; retains retired 410 response |
| `GET /api/jobs` | Job import; same Greenhouse boards API |
| `POST /api/resume`, `/api/export` | Resume routes; same parsers/exporters |
| `POST /api/naukri`, `/api/naukri/detail` | Job import routes; same connector/cache and URL validation |
| `POST /api/ai/status`, `/api/ai/analyze` | AI review routes; same Codex service |
| `POST /api/ai/search-profile`, `/api/ai/search-jobs` | Job search routes; same signed-plan service and diagnostics |

POST Origin, Host, JSON content type and Sec-Fetch-Site checks remain at the central server boundary before dispatch. Request-size limits, HTTP status/error behavior and the `nosniff` header remain intact. Unsupported methods retain 405; unknown GET routes retain 404. Static access is an explicit allowlist, not a general-purpose source/directory server; backend modules, package files and local/QA data remain inaccessible.

Existing `/app.js`, `/style.css` and the nine former root module URLs remain available. The legacy `.mjs` URLs re-export their canonical browser modules, so relative imports resolve correctly after moving files. The new canonical browser module graph is explicitly allowlisted. The original `/app.js?v=<version>` health/bootstrap contract is unchanged.

Hash navigation keeps `#profile`, `#jobs`, `#tracker`, `#companies`, `#ai` and the explicit `#naukri-import=...` transfer. No paths, screens, access guards or lazy-loading behavior were replaced.

## State, authorization and configuration

The app still uses its original mutable state and browser localStorage key `job-applier`. The extraction preserves legacy selection normalization, current-resume revisions, interrupted-search normalization, saved reviews, application statuses, stale-draft checks and the selected/manual plus 80-match persistence policy. Original transient variables now live in an application-scoped `runtime` object with identical initial values. No subscriptions, state library or data migration were added.

Codex account authentication, Plus/included-usage checks, environment filtering, prompt/evidence schemas, disabled tools, search-only web access, model selection and timeouts are unchanged. Search plans continue to use the existing `.local/search-signing-key`. Diagnostic storage explicitly points back to the same project-root `.local/last-search-diagnostic.json` after extraction. No credential/key inspection or replacement was needed.

`package.json`, `package-lock.json`, dependency versions, build/start/test scripts, `.gitignore`, `profile.example.json`, environment inputs and extension permissions are byte-identical to the baseline. `build-browser-helper.mjs` now reads the same parser bytes from their canonical integration location. Extension files and standalone command names are preserved. README architecture references were updated; historical project documents/research remain available.

## Incremental validation

The initial restricted test/browser attempts could not access local HTTP servers or launch Chrome. Repeats outside that sandbox passed before source migration, establishing the baseline without code changes.

| Check | Result |
| --- | --- |
| Baseline `npm test` | 65/65 passed |
| After original file moves/import updates | 65/65 passed |
| After browser/state/API-service extraction | 65/65 passed |
| After backend route extraction | 65/65 passed |
| Final `npm test`, including added behavior regressions | **68/68 passed**, zero failures or skipped tests |
| Baseline and refactored `npm run test:ui` | Both passed: explicit upload/analysis/search, filters, employer counts, failure/reload recovery, real PDF/Word downloads, no unexpected inference, original resume preserved, no browser JS errors, 390px/320px layouts |
| Screenshot comparison | All five baseline/refactored PNGs are **byte-identical**: initial desktop, job results, failed-search empty state, 390px profile and 320px profile |
| Browser/source preservation audit | 85 original nonstructural browser statements match after resolving runtime/service extraction; state restore and every transient initializer match; every original top-level statement is accounted for |
| Domain preservation audit | All 15 otherwise-moved domain/integration modules have identical ASTs apart from import/export paths; original profile/tailoring function ASTs match across extraction |
| File preservation audit | All 60 snapshot files accounted for; HTML, CSS, package/configuration and all extension files byte-identical |
| Module graph | All 43 source modules parse, relative imports resolve, zero circular imports |
| Native Node syntax and import checks | All 70 application, extension, test and standalone-check files pass `node --check`; zero broken relative imports |
| `npm run build:browser-helper` | Passed; generated parser files match the preserved source |
| TypeScript / ESLint / production app build | Not configured in the original project; no scripts/configuration/dependencies added. The app is served directly; browser-helper preparation is its existing build step |

Added regressions cover optional profile/job AI review, wording application resetting approval, reviewed Word download, tracker status/export, Naukri full-JD loading, explicit hash capture staging, same-URL refresh/draft archival, method contracts, malformed JSON, Greenhouse request details, legacy module URLs and private-file exclusion. The existing tests continue to cover subscription authorization, signed plans, source-page evidence, upload/export, parser/blocking states, local-request guards and discovery behavior.

## Practical limits and retained risks

- No live Codex inference or real job-board search was run for this refactor. Their request/protocol, authorization and response paths were validated with controlled integrations and preserved source logic; current remote availability, account quota and job freshness are not verified.
- Existing legacy browser scripts depend on a superseded research-led UI (`#job-search`, for example). They were retained with updated module imports; they are not used to certify the current AI-led UI. The new cross-feature regression covers the current capture/import/review behavior. The old browser-helper end-to-end script is also tied to that earlier result-search control and was not run as a current-UI check.
- There is no Git repository in this workspace. Original bytes and SHA-256/move inventories were saved under ignored `.qa/architecture-baseline/` before source moves, with baseline screenshots in `.qa/architecture-baseline-ui/`. QA migration/audit scripts are ignored tools, not application dependencies.
- Existing scanned-PDF OCR, external-site blocking/staleness and localStorage capacity limits remain as documented in README; the refactor does not alter them.
- Source-path changes require downstream local-file consumers to adopt the map above. All repository consumers were updated; former public browser URLs and root server/browser entry contracts remain supported.

Final validation is complete: **68/68 tests passed**, the current controlled Chrome workflow passed, all five screenshots match the baseline bytes, browser-helper preparation passed, and the preservation/import/cycle audit passed. No unresolved refactor failures remain.
