import { $ } from '../../shared/utils/dom.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createWorkspaceRoutes({ renderAIContext, consumeCaptureFragment }) {
  function syncWorkspace(focus = false) {
    const aiView = location.hash === "#ai";
    for (const id of [
      "job-search-intro",
      "profile",
      "jobs",
      "tracker",
      "companies",
    ])
      $(id).hidden = aiView;
    $("ai").hidden = !aiView;
    document.querySelectorAll("[data-workspace]").forEach((link) => {
      if ((link.dataset.workspace === "ai") === aiView)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    renderAIContext();
    if (focus) {
      const targetId = {
        "#ai": "ai-heading",
        "#jobs": "results-heading",
        "#profile": "profile-heading",
        "#tracker": "tracker-heading",
        "#companies": "company-directory",
      }[location.hash];
      if (targetId) {
        const target = $(targetId);
        target.tabIndex = -1;
        target.scrollIntoView({ behavior: "instant", block: "start" });
        target.focus({ preventScroll: true });
      }
    }
  }

  function bindEvents() {
    document.defaultView.addEventListener("hashchange", () => {
      syncWorkspace(true);
      consumeCaptureFragment();
    });
  }

  return { syncWorkspace, bindEvents };
}
