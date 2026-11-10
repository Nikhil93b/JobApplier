import { $, el, link, download } from '../../../shared/utils/dom.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createTrackerFeature({ state, save, openTailor, downloadResume }) {
  function renderTracker() {
    $("applications").replaceChildren();
    if (!state.profile) {
      $("shortlist-count").textContent = "0 saved jobs";
      $("export").disabled = true;
      return;
    }
    const selectedCount = state.jobs.filter((job) => job.selected && job.source !== "Company research").length;
    $("shortlist-count").textContent =
      `${selectedCount} saved job${selectedCount === 1 ? "" : "s"}`;
    $("export").disabled = !state.jobs.length;
    const step = !state.profile
      ? "step-resume"
      : selectedCount
        ? "step-apply"
        : "step-matches";
    for (const id of ["step-resume", "step-matches", "step-apply"]) {
      if (id === step) $(id).setAttribute("aria-current", "step");
      else $(id).removeAttribute("aria-current");
      $(id).classList.toggle(
        "is-complete",
        id === "step-resume"
          ? Boolean(state.profile)
          : id === "step-matches" && selectedCount > 0,
      );
    }
    for (const job of state.jobs.filter((x) => x.selected && x.source !== "Company research")) {
      const card = el("div", undefined, "job");
      card.append(el("h3", job.title), el("p", job.company));
      const current = job.tailored?.revision === state.revision;
      card.append(
        el(
          "p",
          job.tailored
            ? current
              ? job.tailored.approved
                ? "Resume reviewed · PDF and Word ready"
                : "Resume draft · review needed"
              : "Resume belongs to an earlier upload · regenerate before using"
            : "Ready to tailor your resume",
          "small",
        ),
      );
      const actions = el("div", undefined, "actions"),
        review = el("button", "Tailor / review", "secondary");
      review.disabled = !state.profile;
      review.addEventListener("click", () => openTailor(job.id));
      actions.append(review);
      if (current && job.tailored.approved)
        for (const [format, label] of [
          ["pdf", "Download PDF"],
          ["docx", "Download Word"],
        ]) {
          const button = el("button", label);
          button.addEventListener("click", () => downloadResume(job.id, format));
          actions.append(button);
        }
      actions.append(link(job.url, "Apply on website ↗"));
      const status = el("select");
      status.setAttribute("aria-label", `Application status for ${job.title}`);
      for (const value of [
        "Not applied",
        "Applied",
        "Interview",
        "Offer",
        "Rejected",
      ]) {
        const option = el("option", value);
        option.value = value;
        status.append(option);
      }
      status.value = ["Applied", "Interview", "Offer", "Rejected"].includes(
        job.status,
      )
        ? job.status
        : "Not applied";
      status.addEventListener("change", () => {
        job.status = status.value;
        save();
      });
      actions.append(status);
      card.append(actions);
      $("applications").append(card);
    }
    if (!selectedCount)
      $("applications").append(
        el(
          "p",
          "Your shortlist is empty. In Step 2, click Shortlist to save a promising job, or Select & tailor resume to start a draft.",
          "empty",
        ),
      );
  }

  function bindEvents() {
    $("export").addEventListener("click", () =>
      download(
        new Blob([JSON.stringify(state.jobs, null, 2)], {
          type: "application/json",
        }),
        "job-tracker.json",
      ),
    );
  }

  return { renderTracker, bindEvents };
}
