import { $, el, link, message } from '../../../shared/utils/dom.js';
import { extractProfile } from '../utils/resume.mjs';
import { statedExperience, naukriSearches } from '../../../shared/utils/pune.mjs';
import * as resumeApi from '../services/resume-api.js';

// Existing DOM rendering and handlers, composed with explicit cross-feature callbacks.
export function createResumeFeature({ state, runtime, save, syncDiscoveryButtons, syncResumeSubmit, renderAIReview, renderAIContext, renderSearchProfile, resetFilters, renderJobs, renderCompanies }) {
  function uploadStatus(text, error = false) {
    $("upload-status").textContent = text;
    $("upload-status").classList.toggle("notice", error);
    $("upload-status").classList.toggle("warning", error);
  }

  function renderProfile() {
    const p = state.profile;
    $("capture-confirm").disabled = !p;
    $("ai-profile").disabled = !p || runtime.aiBusy;
    $("ai-profile-results").replaceChildren();
    if (state.aiProfile?.revision === state.revision)
      renderAIReview(state.aiProfile, $("ai-profile-results"));
    renderAIContext();
    syncDiscoveryButtons();
    $("profile-summary").hidden = !p;
    if (!p) return;
    $("profile-name").textContent = p.name || "Your extracted profile";
    $("file-name").textContent = state.filename || "Saved resume";
    $("profile-facts").replaceChildren();
    for (const [label, value] of [
      ["Email", p.email],
      ["Phone", p.phone],
      [
        p.experienceSource === "dates"
          ? "Experience estimated (verify)"
          : "Experience stated",
        p.experience,
      ],
      ["Location stated", p.location],
      [
        p.rolesInferred ? "Possible roles from skills" : "Roles found",
        p.roles.join(", "),
      ],
    ]) {
      const fact = el("div");
      fact.append(el("span", label, "small"), el("strong", value || "Not found"));
      $("profile-facts").append(fact);
    }
    $("extraction-notes").replaceChildren(
      ...(p.warnings || []).map((note) => el("p", note)),
    );
    $("profile-sections").replaceChildren();
    for (const [heading, lines] of Object.entries(p.sections || {})) {
      if (!lines.length) continue;
      const details = el("details");
      details.append(
        el("summary", `${heading} extracted from your resume`),
        el("pre", lines.join("\n")),
      );
      $("profile-sections").append(details);
    }
    $("skills").replaceChildren(
      ...p.skills.map((skill) => el("span", skill, "chip")),
    );
    if (!p.skills.length)
      $("skills").append(
        el(
          "span",
          "No recognized skills found. Review the extracted text or use All fetched openings.",
          "small",
        ),
      );
    $("name").value = p.name;
    $("role").value = p.roles.join(", ");
    $("resume").value = state.resume;
    $("experience-years").value = p.experienceYears ?? "";
    renderSearches();
    renderSearchProfile();
  }

  function renderSearches() {
    $("naukri-searches").replaceChildren();
    for (const search of naukriSearches(state.searchProfile?.revision === state.revision ? state.profile : null)) {
      const card = el("div", undefined, "search-card");
      card.append(
        el("h3", search.area),
        el("p", search.keyword),
        el(
          "p",
          search.experience === null
            ? "Experience not extracted; choose it on Naukri."
            : `${state.profile.experienceSource === "dates" ? "Estimate (verify)" : "Resume"}: ${search.experience} years · whole-year search filter: ${search.filterYears}`,
          "small",
        ),
        link(search.url, `Search Naukri · ${search.area} ↗`),
      );
      $("naukri-searches").append(card);
    }
    if (state.profile)
      $("naukri-note").textContent =
        "These searches use your roles, skills and experience, with Pune and area keywords. Experience uses whole years on Naukri; check its filters after opening a search. Your name, email and phone are excluded from the search links.";
  }

  function bindEvents() {
    $("upload").addEventListener("app-ready", syncDiscoveryButtons);
    $("upload").addEventListener("change", (event) => {
      runtime.pendingResumeFile = null;
      const file = event.target.files[0];
      if (!file) {
        $("selected-file").textContent = "No new file selected.";
        syncResumeSubmit();
        return;
      }
      if (
        file.size > 10 * 1024 * 1024 ||
        !file.size ||
        !/\.(pdf|docx|txt)$/i.test(file.name)
      ) {
        uploadStatus(
          file.size > 10 * 1024 * 1024
            ? "Choose a resume smaller than 10 MB."
            : !file.size
              ? "This file is empty. Choose your resume again."
              : "Choose a PDF, Word .docx or text file. Convert older .doc files to .docx first.",
          true,
        );
        $("selected-file").textContent = "Choose another resume file.";
        $("upload").value = "";
        syncResumeSubmit();
        return;
      }
      runtime.pendingResumeFile = file;
      $("selected-file").textContent = `Ready to submit: ${file.name}`;
      uploadStatus(
        `File selected. Click “Save resume” to continue.${state.profile ? " Existing results still use your saved resume until you submit." : ""}`,
      );
      syncResumeSubmit();
    });
    $("resume-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (runtime.resumeBusy || runtime.researchBusy || runtime.naukriBusy || runtime.aiBusy || $("upload").disabled) return;
      const file = runtime.pendingResumeFile;
      if (!file && !state.profile) {
        uploadStatus(
          "Choose your resume first, then click “Save resume”.",
          true,
        );
        $("upload").focus();
        return;
      }
      runtime.resumeBusy = true;
      runtime.searchGeneration++;
      $("upload").disabled = true;
      syncDiscoveryButtons();
      $("profile").setAttribute("aria-busy", "true");
      $("jobs").setAttribute("aria-busy", "true");
      try {
        if (file) {
          uploadStatus(
            "Reading your resume and finding your roles, skills and experience…",
          );
          const response = await resumeApi.readResume(file);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not read resume.");
          state.resume = data.text;
          state.profile = data.profile;
          state.filename = file.name;
          state.revision = crypto.randomUUID();
          state.sources = [];
          state.fetched = null;
          delete state.aiProfile; delete state.searchProfile; state.currentSearch = null;
          resetFilters();
          runtime.companyPageSize = 12;
          save();
          renderProfile();
          renderJobs();
          renderCompanies();
        }
        uploadStatus('Resume saved. Choose Analyze resume for job search, then Search jobs with AI.');
        renderSearchProfile();
      } catch (error) {
        uploadStatus(
          `${error.message} ${state.profile ? "Your previous resume and matches are still available." : "Choose another file and try again."}`,
          true,
        );
      } finally {
        runtime.pendingResumeFile = null;
        runtime.resumeBusy = false;
        $("upload").disabled = false;
        $("upload").value = "";
        $("selected-file").textContent = state.profile
          ? "Saved resume available. Choose a new file only to replace it."
          : "No new file selected.";
        $("profile").removeAttribute("aria-busy");
        $("jobs").removeAttribute("aria-busy");
        syncDiscoveryButtons();
      }
    });
    $("reextract").addEventListener("click", () => {
      const text = $("resume").value.trim();
      if (text.length < 40) {
        message("Keep enough resume text to extract your profile.");
        return;
      }
      state.resume = text;
      delete state.searchProfile; state.currentSearch = null;
      state.profile = extractProfile(text);
      state.revision = crypto.randomUUID();
      save();
      resetFilters();
      renderProfile();
      renderJobs();
      renderCompanies();
      message("Profile updated. Job matches have been recalculated.");
    });
    for (const key of ["name", "role", "experience-years"])
      $(key).addEventListener("change", () => {
        if (!state.profile) return;
        if (key === "name") state.profile.name = $("name").value.trim();
        else if (key === "role") {
          state.profile.roles = $("role")
            .value.split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          state.profile.rolesInferred = false;
        } else {
          state.profile.experienceYears =
            $("experience-years").value === ""
              ? null
              : statedExperience(Number($("experience-years").value));
          state.profile.experience =
            state.profile.experienceYears === null
              ? ""
              : `${state.profile.experienceYears} years stated`;
        }
        save();
        renderSearches();
        renderJobs();
      });
  }

  return { renderProfile, uploadStatus, bindEvents };
}
