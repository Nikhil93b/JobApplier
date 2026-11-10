import { $, el, message, download } from '../../../shared/utils/dom.js';
import { safeUrl } from '../../../shared/utils/match.mjs';
import { tailorResume } from '../utils/tailor-resume.mjs';
import * as tailoringApi from '../services/tailoring-api.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createTailoringFeature({ state, runtime, save, renderJobs, renderTracker, renderAIReview, beginImport, loadNaukriJD }) {
  function openTailor(id) {
    const job = state.jobs.find((x) => x.id === id);
    if (!job || !state.profile) return;
    if (job.partialDescription) {
      if (job.source === "Naukri" && !job.capturedAt) loadNaukriJD(job);
      else {
        beginImport(job);
        if (job.capturedAt)
          message(
            "Capture the full Naukri job page with the helper, or paste its complete description below.",
          );
      }
      return;
    }
    if (
      job.tailored &&
      job.tailored.revision !== state.revision &&
      !confirm(
        "This draft belongs to an earlier resume. Replace it with a draft from your current resume?",
      )
    )
      return;
    if (!job.tailored || job.tailored.revision !== state.revision)
      job.tailored = {
        ...tailorResume(state.resume, state.profile, job),
        original: state.resume,
        revision: state.revision,
        approved: false,
      };
    job.selected = true;
    runtime.activeJob = id;
    save();
    renderJobs();
    $("tailor-job").textContent = `${job.title} · ${job.company}`;
    $("tailor-note").textContent = job.tailored.note;
    $("tailor-matched").replaceChildren(
      ...job.tailored.matched.map((x) => el("span", x, "chip")),
    );
    if (!job.tailored.matched.length)
      $("tailor-matched").append(
        el("span", "No recognized overlapping skills.", "small"),
      );
    $("tailor-missing").replaceChildren(
      ...job.tailored.missing.map((x) => el("span", x, "chip missing")),
    );
    $("tailor-evidence").replaceChildren();
    if (job.tailored.evidence.length) {
      $("tailor-evidence").append(
        el("h3", "Relevant lines from your original resume"),
      );
      job.tailored.evidence.forEach((x) =>
        $("tailor-evidence").append(el("blockquote", x)),
      );
    }
    $("tailor-changes").replaceChildren(
      ...job.tailored.changes.map((x) => el("li", x)),
    );
    $("original-preview").textContent = job.tailored.original;
    $("tailored-text").value = job.tailored.text;
    $("approved").checked = job.tailored.approved;
    const url = safeUrl(job.url);
    $("apply-link").hidden = !url;
    if (url) $("apply-link").href = url;
    $("tailor-status").textContent = "";
    $("ai-job").disabled = runtime.aiBusy;
    $("ai-job-status").textContent = "";
    $("ai-job-results").replaceChildren();
    if (job.aiReview?.revision === state.revision)
      renderAIReview(job.aiReview, $("ai-job-results"), job);
    setDownloadState();
    $("tailor").showModal();
  }

  function setDownloadState() {
    const job = state.jobs.find((x) => x.id === runtime.activeJob);
    const ready =
      job?.tailored?.approved && job.tailored.revision === state.revision;
    $("download-pdf").disabled = !ready;
    $("download-docx").disabled = !ready;
  }

  async function downloadResume(id, format) {
    const job = state.jobs.find((x) => x.id === id);
    if (!job?.tailored?.approved || job.tailored.revision !== state.revision) {
      message("Review the current resume before downloading.");
      return;
    }
    const report = (text) => {
      message(text);
      if (runtime.activeJob === id && $("tailor").open)
        $("tailor-status").textContent = text;
    };
    report(`Preparing ${format.toUpperCase()} resume…`);
    try {
      const response = await tailoringApi.exportResume(job.tailored.text, format);
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not export resume.",
        );
      download(
        await response.blob(),
        `${job.company}-${job.title}-resume.${format}`.replace(
          /[<>:"/\\|?*]/g,
          "-",
        ),
      );
      report("Resume downloaded. Apply using the employer’s website.");
    } catch (error) {
      report(error.message);
    }
  }

  function bindEvents() {
    $("tailored-text").addEventListener("input", () => {
      const job = state.jobs.find((x) => x.id === runtime.activeJob);
      if (!job?.tailored) return;
      job.tailored.text = $("tailored-text").value;
      job.tailored.approved = false;
      $("approved").checked = false;
      setDownloadState();
      save();
      renderTracker();
    });
    $("approved").addEventListener("change", () => {
      const job = state.jobs.find((x) => x.id === runtime.activeJob);
      if (!job?.tailored) return;
      if (!$("tailored-text").value.trim()) {
        $("approved").checked = false;
        $("tailor-status").textContent = "Resume text cannot be empty.";
        return;
      }
      job.tailored.approved = $("approved").checked;
      save();
      setDownloadState();
      renderTracker();
    });
    $("download-pdf").addEventListener("click", () =>
      downloadResume(runtime.activeJob, "pdf"),
    );
    $("download-docx").addEventListener("click", () =>
      downloadResume(runtime.activeJob, "docx"),
    );
    $("close").addEventListener("click", () => $("tailor").close());
  }

  return { openTailor, setDownloadState, downloadResume, bindEvents };
}
