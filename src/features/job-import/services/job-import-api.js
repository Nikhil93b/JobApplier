// Preserve endpoint payloads and return the original Response for feature-specific handling.
export function loadNaukriJD(url) {
  return fetch("/api/naukri/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url }),
    });
}

export function fetchBoard(board) {
  return fetch(
      `/api/jobs?board=${encodeURIComponent(board)}`,
    );
}
