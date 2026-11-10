// Preserve endpoint payloads and return the original Response for feature-specific handling.
export function readResume(file) {
  return fetch(
        `/api/resume?filename=${encodeURIComponent(file.name)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        },
      );
}
