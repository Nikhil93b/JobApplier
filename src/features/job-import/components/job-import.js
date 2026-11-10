import { $, el, message, plainDescription } from '../../../shared/utils/dom.js';
import { safeUrl } from '../../../shared/utils/match.mjs';
import { findJob, updateJob } from '../../../shared/utils/jobs.mjs';
import { maxCaptureLength, validateNaukriCapture, decodeNaukriCapture } from '../../../services/integrations/naukri/naukri-capture.mjs';
import * as jobImportApi from '../services/job-import-api.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createJobImportFeature({ state, runtime, save, renderJobs, visibleJobs, openTailor }) {
  function openJobGuide() {
    $("naukri-guide").open = true;
    $("naukri-guide").scrollIntoView({ behavior: "smooth", block: "start" });
    $("naukri-guide").querySelector("summary").focus({ preventScroll: true });
  }

  function mergeJobs(data) {
    for (const job of data.jobs) {
      if (!safeUrl(job.url)) continue;
      const normalized = {
        ...job,
        description:
          job.description || plainDescription(job.descriptionHtml || ""),
        fetched: data.fetched,
      };
      delete normalized.descriptionHtml;
      const previous = findJob(state.jobs, normalized);
      if (previous) updateJob(previous, normalized);
      else state.jobs.push({ ...normalized, id: crypto.randomUUID() });
    }
  }

  function showSourceFailure(detail) {
    $("discovery-status").textContent =
      "Naukri could not be read automatically. Your saved jobs are still available. Use “Find jobs on Naukri”, then add a job description.";
    $("source-error").textContent = detail;
    $("source-error-details").hidden = false;
  }

  function stageCapture(capture) {
    runtime.pendingCapture = capture;
    $("capture-preview").hidden = false;
    $("capture-jobs").replaceChildren(
      ...capture.jobs.map((job) =>
        el(
          "li",
          `${job.title} · ${job.company} · ${job.location || "location unspecified"} · ${job.partialDescription ? "partial JD" : "complete JD"}`,
        ),
      ),
    );
    $("capture-status").textContent =
      `${capture.jobs.length} job(s) from your Naukri browser page, captured ${new Date(capture.capturedAt).toLocaleString()}. Review before importing. Availability has not been rechecked.${state.profile ? "" : " Upload your resume first."}`;
    $("capture-confirm").disabled =
      !state.profile || runtime.resumeBusy || runtime.researchBusy || runtime.naukriBusy;
    if (state.profile)
      $("capture-preview").scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }

  async function loadNaukriJD(job) {
    if (runtime.loadingNaukriJobs.has(job.id)) return;
    const revision = state.revision;
    runtime.loadingNaukriJobs.add(job.id);
    message("Reading the complete job description from Naukri…");
    try {
      const response = await jobImportApi.loadNaukriJD(job.url);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not read the Naukri job.");
      if (
        data.status !== "available" ||
        !data.job?.description ||
        data.job.partialDescription !== false
      )
        throw new Error(data.message || "No complete description was available.");
      const details = data.job;
      if (job.description !== details.description) {
        delete job.aiReview;
        if (job.tailored) {
          job.previousTailored ||= [];
          job.previousTailored.push(job.tailored);
          delete job.tailored;
        }
      }
      Object.assign(job, {
        ...details,
        title: details.title || job.title,
        company: details.company || job.company,
        location: details.location || job.location,
      });
      job.selected = true;
      save();
      renderJobs();
      message(
        "Complete Naukri description loaded. Review the source and job requirements before tailoring.",
      );
      if (state.revision === revision) openTailor(job.id);
    } catch (error) {
      message(error.message);
      if (state.revision === revision) beginImport(job);
    } finally {
      runtime.loadingNaukriJobs.delete(job.id);
    }
  }

  function beginImport(job = null) {
    if (!state.profile) {
      message("Upload your resume first.");
      return;
    }
    runtime.importTarget = job?.id || null;
    $("advanced").open = true;
    $("jobform").reset();
    $("title").value = job?.title || "";
    $("company").value = job?.company || "";
    $("job-location").value = job?.location || "Pune (exact area unconfirmed)";
    $("url").value = job?.url || "";
    $("import-note").textContent = job
      ? "This lead has only a partial description. Open its source and paste the COMPLETE job description below before tailoring. Check the location and stated requirements."
      : "Paste a selected Naukri/company job with its exact title, employer, location and complete description.";
    $("jobform").scrollIntoView({ behavior: "smooth", block: "center" });
    (job ? $("description") : $("title")).focus({ preventScroll: true });
  }

  function consumeCaptureFragment() {
    const captureFragment = new URLSearchParams(location.hash.slice(1)).get(
      "naukri-import",
    );
    if (!captureFragment) return;
    document.defaultView.history.replaceState(
      null,
      "",
      location.pathname + location.search,
    );
    try {
      stageCapture(decodeNaukriCapture(captureFragment));
    } catch (error) {
      $("capture-status").textContent = error.message;
    }
  }

  function bindEvents() {
    $("naukri-capture").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      runtime.pendingCapture = null;
      $("capture-preview").hidden = true;
      try {
        if (file.size > maxCaptureLength * 4)
          throw new Error("The Naukri capture is too large. Import fewer jobs.");
        stageCapture(validateNaukriCapture(await file.text()));
      } catch (error) {
        $("capture-status").textContent = error.message;
      } finally {
        event.target.value = "";
      }
    });
    $("capture-confirm").addEventListener("click", () => {
      if (
        !runtime.pendingCapture ||
        !state.profile ||
        runtime.resumeBusy ||
        runtime.researchBusy ||
        runtime.naukriBusy
      )
        return;
      const capture = runtime.pendingCapture;
      runtime.searchGeneration++;
      mergeJobs({ jobs: capture.jobs, fetched: new Date().toISOString() });
      state.sources = [
        ...state.sources.filter(
          (source) => source.name !== "Naukri browser import",
        ),
        { name: "Naukri browser import", ok: true, count: capture.jobs.length },
      ];
      save();
      renderJobs();
      runtime.pendingCapture = null;
      $("capture-preview").hidden = true;
      $("capture-status").textContent =
        `Imported ${capture.jobs.length} captured job(s). Exact Naukri URLs update existing entries. Current filters show ${visibleJobs().length} jobs.`;
    });
    $("capture-cancel").addEventListener("click", () => {
      runtime.pendingCapture = null;
      $("capture-preview").hidden = true;
      $("capture-status").textContent =
        "Capture discarded. Saved jobs are unchanged.";
    });
    $("open-job-guide").addEventListener("click", openJobGuide);
    $("guide-import").addEventListener("click", () => beginImport());
    $("import-new").addEventListener("click", () => beginImport());
    $("cancel-import").addEventListener("click", () => {
      runtime.importTarget = null;
      $("jobform").reset();
      $("advanced").open = false;
    });
    $("jobform").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.profile) {
        message("Upload your resume first.");
        return;
      }
      const url = safeUrl($("url").value);
      if (!url) {
        message("Use an HTTP or HTTPS job link.");
        return;
      }
      const description = $("description").value.trim();
      if (description.length < 80) {
        message("Paste the complete job description, at least 80 characters.");
        return;
      }
      const details = {
        title: $("title").value.trim(),
        company: $("company").value.trim(),
        location: $("job-location").value.trim(),
        description,
        url,
        partialDescription: false,
      };
      let job = state.jobs.find((x) => x.id === runtime.importTarget);
      if (job) {
        Object.assign(job, details);
        delete job.aiReview;
        delete job.minExperience;
        delete job.maxExperience;
        if (job.tailored) {
          job.previousTailored ||= [];
          job.previousTailored.push(job.tailored);
          delete job.tailored;
        }
      } else {
        if (state.jobs.some((x) => x.url === url && x.title === details.title)) {
          message("This job is already saved.");
          return;
        }
        const host = new URL(url).hostname;
        job = {
          ...details,
          id: crypto.randomUUID(),
          source:
            host === "naukri.com" || host.endsWith(".naukri.com")
              ? "Naukri (manual import)"
              : "Manual",
        };
        state.jobs.push(job);
      }
      job.selected = true;
      runtime.importTarget = null;
      save();
      event.target.reset();
      $("advanced").open = false;
      renderJobs();
      message(
        "Full job description saved. Review the match and tailor your resume.",
      );
      openTailor(job.id);
    });
    $("discover-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!state.profile) {
        message("Upload your resume first.");
        return;
      }
      $("discover").disabled = true;
      try {
        const response = await jobImportApi.fetchBoard($("board").value);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        mergeJobs(data);
        save();
        renderJobs();
        message(`Added/refreshed ${data.jobs.length} company openings.`);
      } catch (error) {
        message(error.message);
      } finally {
        $("discover").disabled = false;
      }
    });
  }

  return { beginImport, loadNaukriJD, consumeCaptureFragment, bindEvents };
}
