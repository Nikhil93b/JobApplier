// Preserve endpoint payloads and return the original Response for feature-specific handling.
export function status() {
  return fetch("/api/ai/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
}

export function analyze(task, resume, job, description) {
  return fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task,
        resume: resume,
        ...(job
          ? {
              job: {
                title: job.title,
                company: job.company,
                description,
                partialDescription: job.partialDescription,
              },
            }
          : {}),
      }),
    });
}
