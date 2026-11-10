// Preserve endpoint payloads and return the original Response for feature-specific handling.
export function exportResume(text, format) {
  return fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, format }),
    });
}
