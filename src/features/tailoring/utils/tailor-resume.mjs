import { skills, match } from '../../../shared/utils/match.mjs';
import { experienceFit } from '../../../shared/utils/pune.mjs';

export function jobAnalysis(profile, job) {
  const result = match(profile.skills, `${job.title}\n${job.description}`);
  const roleMatch = profile.roles.some(role => {
    const meaningful = role.toLowerCase().split(/\s+/).filter(x => !['developer', 'engineer', 'senior', 'junior'].includes(x));
    return meaningful.length ? meaningful.some(x => job.title.toLowerCase().includes(x)) : false;
  });
  const meaningfulMatches = result.matched.filter(x => !['Communication', 'Leadership', 'Agile', 'Scrum', 'Git', 'CI/CD', 'Project Management'].includes(x));
  const incompatibleStack = [['Java', 'Spring Boot'], ['.NET', 'C#', 'ASP.NET Core'], ['PHP', 'Laravel']].some(stack => skills(job.title).some(x => stack.includes(x)) && !profile.skills.some(x => stack.includes(x)));
  const experience = experienceFit(profile, job);
  return { ...result, roleMatch, experience, relevant: !incompatibleStack && (meaningfulMatches.length > 0 || roleMatch), rank: (result.score || 0) + (roleMatch ? 20 : 0) + (experience.status === 'within' ? 10 : 0) };
}
export function tailorResume(original, profile, job) {
  const analysis = jobAnalysis(profile, job);
  const lines = original.split(/\r?\n/);
  // Keep all original facts. Reorder a recognized inline skills list only.
  let reordered = false;
  const edited = lines.map(line => {
    const heading = line.match(/^(\s*(?:technical\s+|core\s+)?skills\s*:\s*)(.+)$/i);
    if (!heading) return line;
    const parts = heading[2].split(/[,;|]/).map(x => x.trim()).filter(Boolean);
    if (parts.length < 2) return line;
    const priority = item => skills(item).some(x => analysis.matched.includes(x)) ? 1 : 0;
    const sorted = [...parts].sort((a, b) => priority(b) - priority(a));
    if (sorted.join(', ') !== parts.join(', ')) reordered = true;
    return heading[1] + sorted.join(', ');
  }).join('\n');
  const evidence = original.split(/\r?\n/).filter(line => line.length > 35 && line.length < 450 && !/skills\s*:/i.test(line) && skills(line).some(x => analysis.matched.includes(x))).slice(0, 4);
  return { text: edited, matched: analysis.matched, missing: analysis.missing, evidence, changes: reordered ? ['Reordered the existing skills list to put job-relevant skills first.'] : [], note: 'Review the job keywords and evidence below, then edit your resume. This version preserves your original facts; it does not generate AI rewrites.' };
}
