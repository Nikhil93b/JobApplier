# Full project development roadmap

Last updated: 22 October 2026. Approved current scope: explicit AI analysis, Codex-led online vacancy discovery, AI fit ranking and no fixed research results. Delivered details and evidence are tracked separately in [DEVELOPMENT_COMPLETED.md](DEVELOPMENT_COMPLETED.md).

Status meanings: **Done** = implemented and checked; **Partial** = useful behavior exists with stated limits; **Planned** = not implemented; **Discuss first** = needs a product decision before implementation. Update both tracking documents after each milestone; never mark a milestone done solely because a controlled fixture passes.

## Approved product flow

```text
Save original resume
  -> Analyze resume with a separate button
  -> Inspect AI-suggested roles, technical skills, methods and experience
  -> Search those roles online through Codex
  -> Validate sources and rank fit
  -> Review/shortlist
  -> Obtain complete JD
  -> Review tailored version
  -> Download PDF/Word
  -> Apply manually and track outcome
```

If analysis or online retrieval fails, discovery stays empty. Fixed job/company lists must never be used as a fallback. An office address or career homepage alone is not a vacancy.

## Milestones and acceptance criteria

| Phase | Scope | Status | Acceptance / remaining work |
|---|---|---|---|
| 1. Local foundation | Node backend, browser UI, health/version checks and request validation | Done | App runs locally; incompatible backend is clearly reported; no frontend framework or microservice migration is required |
| 2. Resume ingestion | PDF/.docx/text parsing, original preservation, bad-file handling | Done | Readable resume text extracted; invalid replacements preserve the prior valid resume; downloads do not overwrite the original |
| 2a. Document completeness | OCR for scanned resumes and legacy `.doc` support | Planned | Add only after choosing conversion/OCR approach; show confidence and unsupported-file guidance |
| 3. On-demand AI analysis | AI roles, recent-experience/skills priorities, technical and development-method keywords, supported total experience | Done | Separate action; evidence displayed; no search starts during upload or analysis; unsupported output fails closed |
| 3a. Search-profile refinement | Per-role skill weights, recency weighting, per-skill years, user selection/correction of suggested roles | Planned | Define editable fields and evidence rules; preserve a clear explanation for role recommendations; avoid incidental/negated skills |
| 4. Live Codex discovery | Search analyzed roles, Pune/localities, Naukri-first and accessible public source alternatives | Done with source limits | Real hosted web-search events observed and accepted vacancy pages obtained. Site restrictions and limited coverage remain; no Naukri ingestion guarantee |
| 4a. Discovery quality | Freshness windows, pagination/coverage by role and source, stronger closed-listing checks | Planned | Track source dates and unknowns; distinguish no openings from unreadable sources; do not pad the list |
| 4b. Longer searches | Progress per source/role, cancellation, background worker, bounded retries | Planned | Cancellable/resumable jobs with revision-safe updates; explicit retry must never silently restore stale results |
| 5. AI ranking | Role/keyword/experience fit, score and reason, missing requirements, source grounding | Done with stated limits | Source-backed results sorted by AI score by default; known experience incompatibilities excluded; scores never described as hiring probabilities |
| 5a. Detailed fit evaluation | Compare every complete JD with recent resume evidence, mandatory vs preferred requirements, evaluation set | Planned | Calibrate ranking on varied Java/.NET/frontend/data/DevOps resumes; expose uncertainty and evidence instead of generic fit claims |
| 6. Employer suggestions | Employers derived from current search, no researched directory fallback | Done | No companies before successful search; failed searches clear employer suggestions; role-dependent results determine the employer list |
| 7. Review and shortlist | Source links, shortlist, job-detail import and deduplication | Done | Preserve full descriptions when refreshing summaries; archive drafts when requirements change; allow manual source review |
| 7a. Search feedback | Hide irrelevant jobs, record dismissal reasons, tune subsequent searches | Planned | Feedback must not change candidate facts or silently broaden role/location scope |
| 8. Resume tailoring | Separate per-job draft, original comparison, optional evidence-based AI edits, approval | Done | Requires complete JD and explicit accuracy review; editing revokes download approval; never invent experience |
| 8a. Resume layout | Better original-layout preservation, selectable templates, export preview | Planned | Render and visually compare representative PDFs/Word files; explain reconstruction limits |
| 9. Applications | Manual Apply links, status tracking, tracker export | Done | Opening a URL does not mark Applied; no automatic submissions |
| 9a. Assisted applications | Form assistance, final user review and submission boundaries | Discuss first | Define supported sites and exact permission scope before implementing |
| 10. Resume replacement/history | Separate results/history/archive behavior when replacing a resume | **Discuss first — next development point** | User explicitly deferred this topic. Decide what to retain, separate, archive or clear before building a history policy. Current result visibility remains bound to the active resume revision |
| 11. Persistence and portability | Server-side durable storage, backups and restore/import | Planned | Choose SQLite for a personal local edition; decide hosted requirements before PostgreSQL/multi-user storage; migrate existing local storage without losing applications |
| 12. Architecture and operations | Modular monolith, configuration, structured diagnostics and bounded workloads | Partial | Keep one deployable app. New search policy/validation is separated from transport. Move feature modules deliberately when needed; microservices require a concrete scaling/team reason |
| 13. Privacy and reliability | Included-usage-only routing, minimized search payloads, exact evidence validation, source allow/deny handling | Partial | Existing protections tested; add task cancellation, retention controls and broader adversarial/source-quality evaluations |
| 14. Release readiness | Cross-browser accessibility, regression coverage, installation guide and real-source acceptance | Partial | Current DOM/Chrome/mobile checks pass, including persisted error messages and employer-filter recovery. Add Edge/accessibility coverage and maintain separate controlled-workflow vs live-source reports |

## Next development points

1. Discuss replacement-resume results/history/archive behavior (user-deferred item 6). Do not silently introduce a new history policy.
2. Gather user feedback on AI-proposed roles and search results with actual resumes; record relevant/irrelevant examples for ranking improvements.
3. Decide whether users should select a subset of AI-suggested roles or edit suggestions before search.
4. Improve source freshness/coverage, explicit source failure reporting and complete-JD retrieval.
5. Add cancellable background search if synchronous searches become too slow.

These are future points, not changes implemented in the 21 October milestone.

## Change tracking procedure

For each milestone, record date, approved behavior, files changed, automated checks, visual/live verification, and remaining limitations in `DEVELOPMENT_COMPLETED.md`. Update the corresponding phase here. Keep synthetic test fixtures separate from production job data. Historical research is reference material only. Do not claim live acceptance from mocks, prepared links or screenshots of controlled vacancies.


## Latest reliability update ? 22 October 2026

Delivered restart-safe search-profile authorization, explicit expired-profile recovery, saved search status/errors, source/exclusion diagnostics, a Step 2 search action, and correct total-versus-filtered employer counts. Keep these regression cases in release checks. Resume replacement/history/archive policy remains deferred; this update does not decide it. Cancellable background searches, broader relevance evaluation and source coverage are still planned.
