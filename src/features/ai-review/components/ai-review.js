import { $, el } from '../../../shared/utils/dom.js';
import * as aiReviewApi from '../services/ai-review-api.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createAIReviewFeature({ state, runtime, save, syncDiscoveryButtons, setDownloadState, renderTracker }) {
  function renderAIContext() {
    const currentReview = state.aiProfile?.revision === state.revision;
    $("ai-resume-needed").hidden = Boolean(state.profile);
    $("ai-resume-context").hidden = !state.profile;
    $("ai-resume-context").textContent = state.profile
      ? `Resume: ${state.filename || "your saved resume"}. ${currentReview ? "Showing the latest saved review for this resume." : "Choose Analyze below when you are ready for a review."}`
      : "";
    $("ai-review-empty").hidden = Boolean(currentReview);
  }

  function renderAIReview(review, target, job = null) {
    target.replaceChildren(el("p", review.summary));
    for (const [key, heading] of [
      ["supportedFacts", "Resume facts identified by AI"],
      ["gaps", "Gaps and points to verify"],
      ["questions", "Questions for you"],
    ]) {
      if (!review[key]?.length) continue;
      const list = el("ul");
      list.append(...review[key].map((text) => el("li", text)));
      target.append(el("h3", heading), list);
    }
    for (const suggestion of review.suggestions || []) {
      const card = el("div", undefined, "job");
      card.append(
        el("h3", "Suggested wording"),
        el("p", "Original", "small"),
        el("blockquote", suggestion.original),
        el("p", "Suggested", "small"),
        el("blockquote", suggestion.suggested),
        el("p", `Why: ${suggestion.reason}`, "small"),
        el("p", "Evidence in your original resume", "small"),
        el("blockquote", suggestion.evidence),
      );
      if (job) {
        const apply = el("button", "Use this wording in my draft", "secondary");
        apply.addEventListener("click", () => {
          if (
            runtime.activeJob !== job.id ||
            review.revision !== state.revision ||
            job.tailored?.revision !== state.revision
          )
            return;
          const text = $("tailored-text").value,
            first = text.indexOf(suggestion.original);
          if (first < 0 || text.indexOf(suggestion.original, first + 1) >= 0) {
            $("ai-job-status").textContent =
              "The original line is missing or repeated in this draft. Compare the suggestion and edit the text manually.";
            return;
          }
          $("tailored-text").value =
            text.slice(0, first) +
            suggestion.suggested +
            text.slice(first + suggestion.original.length);
          job.tailored.text = $("tailored-text").value;
          job.tailored.approved = false;
          $("approved").checked = false;
          save();
          setDownloadState();
          renderTracker();
          apply.disabled = true;
          $("ai-job-status").textContent =
            "Wording added to the draft. Review it and confirm accuracy before downloading.";
        });
        card.append(apply);
      }
      target.append(card);
    }
    target.append(
      el(
        "p",
        `${review.provider} · ${review.model}. AI suggestions require your review.`,
        "small",
      ),
    );
  }

  async function requestAI(task) {
    if (!state.profile || runtime.aiBusy) return;
    const job =
      task === "job" ? state.jobs.find((x) => x.id === runtime.activeJob) : null;
    if (task === "job" && (!job || job.partialDescription)) return;
    const revision = state.revision,
      description = job?.description;
    const status = $(job ? "ai-job-status" : "ai-status");
    runtime.aiBusy = true; syncDiscoveryButtons();
    $("ai-profile").disabled = true;
    $("ai-job").disabled = true;
    status.textContent = "Reviewing with ChatGPT Plus. This may take a minute…";
    try {
      const response = await aiReviewApi.analyze(task, state.resume, job, description);
      const review = await response.json();
      if (!response.ok) throw new Error(review.error || "AI review failed.");
      if (
        revision !== state.revision ||
        (job && job.description !== description)
      ) {
        status.textContent =
          "The resume or job changed during analysis. Run AI review again for the current version.";
        return;
      }
      review.revision = revision;
      if (job) {
        job.aiReview = review;
        if (runtime.activeJob === job.id)
          renderAIReview(review, $("ai-job-results"), job);
      } else {
        state.aiProfile = review;
        renderAIReview(review, $("ai-profile-results"));
        renderAIContext();
      }
      save();
      status.textContent =
        "AI review ready. Check the facts and evidence; your resume text has not changed.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      runtime.aiBusy = false; syncDiscoveryButtons();
      $("ai-profile").disabled = !state.profile;
      $("ai-job").disabled = false;
    }
  }

  function bindEvents() {
    $("ai-check").addEventListener("click", async () => {
      $("ai-check").disabled = true;
      $("ai-status").textContent =
        "Checking your local ChatGPT connection and included allowance…";
      try {
        const response = await aiReviewApi.status();
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not check the AI connection.");
        $("ai-status").textContent = data.message;
      } catch (error) {
        $("ai-status").textContent = error.message;
      } finally {
        $("ai-check").disabled = false;
      }
    });
    $("ai-profile").addEventListener("click", () => requestAI("profile"));
    $("ai-job").addEventListener("click", () => requestAI("job"));
  }

  return { renderAIContext, renderAIReview, bindEvents };
}
