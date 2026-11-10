import { naukriJobUrl } from '../../services/integrations/naukri/naukri-page.mjs';

export function updateJob(previous, incoming) {
  const next = { ...incoming };
  if (!previous.partialDescription && next.partialDescription) { delete next.description; delete next.partialDescription; }
  if (['title', 'company', 'location', 'description', 'minExperience', 'maxExperience'].some(key => key in next && next[key] !== previous[key])) {
    delete previous.aiReview;
    if (previous.tailored) { previous.previousTailored ||= []; previous.previousTailored.push(previous.tailored); delete previous.tailored; }
  }
  Object.assign(previous, next); return previous;
}
export function findJob(jobs, incoming) {
  const naukriUrl = naukriJobUrl(incoming.url);
  return jobs.find(job => (naukriUrl && naukriJobUrl(job.url) === naukriUrl) || (incoming.sourceId && incoming.source && job.source === incoming.source && job.sourceId === incoming.sourceId) || (job.url === incoming.url && job.title === incoming.title));
}
