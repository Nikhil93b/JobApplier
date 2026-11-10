# Review results - 16 October 2026

## Live Naukri outcome

**Automated live Naukri retrieval is still not working.** A real request returns HTTP 403 Access Denied and zero records. `npm run test:naukri:live` correctly exits with code 1. Controlled browser pages are explicitly separate from real-source acceptance.

The source access block is external to card extraction. No stealth, private API, cookie copying, proxy rotation or challenge bypass was introduced. An approved source feed has not been identified. Whether Naukri works in the user's normal browser remains unconfirmed.

## Changes completed

- Renamed the automated-access control to avoid promising a working live feed.
- Added strict real-source acceptance and separated workflow/fixture/live-source report fields.
- Fixed legitimate job text being rejected for mentioning security checks.
- Skip malformed upstream records without discarding valid jobs.
- Removed transient browser-busy/failure results from reusable source caches.
- Serialize conflicting discovery actions and restore both controls after slow requests or failures.
- Centralized job merging: changed requirements archive drafts and clear current approval/AI review; partial summaries preserve a complete imported JD.
- Deduplicate Naukri URLs across manual and browser imports.
- Report each endpoint's actual request-size limit.
- Prepared a user-triggered browser helper with `activeTab`/`scripting` permissions only. It captures chosen job-page fields, not browser credentials, cookies, resume text or form values.
- Added validated capture links/files, explicit import preview, safe text rendering, Unicode support and repeated-import handling. URL fragments are removed from the visible address before preview and never sent to the local HTTP server.

## Validation

Resume used: `C:\Users\asus\Downloads\Nikhil_SoftwareDev (1).docx`.

| Check | Result | What it establishes |
|---|---|---|
| Automated suite | 51 tests passed | Existing workflows plus schema, deduplication, changed-JD approval, offline/slow-request recovery and endpoint validation |
| Complete isolated Chrome workflow | Workflow passed, real source failed | Resume upload, filtering, controlled Naukri parsing/full JD, review, PDF/Word downloads, tracker persistence and invalid-upload recovery; no claim of working live search |
| Browser-helper Chrome flow | Passed with controlled pages and simulated extension APIs | Actual popup code, constrained destination, capture transfer, confirmation, duplicate imports, full-JD upgrades, old-draft invalidation and invalid-data rejection |
| Strict real Naukri acceptance | Failed: HTTP 403, zero records | Automatic retrieval remains externally blocked |
| Current AI verification | Existing Plus-only unit guards and mocked browser AI passed | No additional Plus allowance was spent on this review; the previous live AI verification is historical, not a new live claim |

The normal browser profile was not modified and the extension was not installed there. No application was submitted. The isolated browser test verifies that the original resume file remains unchanged. The latest QA-generated resume is a test artifact for a controlled role, not a real application document.

## Dependency security check

`npm audit --json` reports three moderate affected dependency nodes in the chain `mammoth -> argparse -> sprintf-js`, corresponding to one reviewed advisory: [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). No high/critical advisories were reported. The advisory states that patched versions are unavailable. The vulnerable behavior concerns attacker-controlled formatting strings; exploitation through this app's `mammoth.extractRawText` call is not established by the review. No destructive proof of concept was run.

The audit's proposed automated remedy is an old major-version downgrade of Mammoth, not a verified compatible security update. It was not applied blindly. Track an upstream fix and assess the CLI-only dependency path separately from the existing expanded-document work-budget concern.

## Remaining work and ranked-review status

Findings 2-7 and 10 in `PROJECT_REVIEW.md` received the targeted fixes above. Finding 1 remains open because real source access is denied. Finding 8 (conflicting writes from multiple normal app tabs) and finding 9 (document-parser expansion/work budgets) remain open for subsequent hardening. The app is still local and single-user; it is not being declared ready for public multi-user hosting.

On 16 October the user confirmed that Naukri job results open normally in their regular Chrome/Edge browser. The prepared page-import path is therefore applicable, but has not yet been verified with that real page. The browser-control inventory exposes no connected browser tabs, so the user must perform the one-time extension loading and initial capture in that browser. Load the prepared `browser-helper` folder using its setup instructions, then capture a real results/JD page. The helper does not make denied pages accessible. See [browser-helper/README.md](browser-helper/README.md).
