import { resumeKeywords } from './match.mjs';
export const targetRegion = { city: 'Pune', areas: ['Baner', 'Balewadi', 'Hinjewadi Phase 1', 'Hinjewadi Phase 2', 'Hinjewadi Phase 3'] };
export function statedExperience(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 && text <= 60 ? text : null;
  const value = String(text || '');
  const match = value.match(/\b(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:(?:of|in|professional|total|relevant|work)\s+){0,3}(?:experience|exp)\b/i) || value.match(/(?:total\s+|professional\s+)?(?:experience|exp)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i);
  return match ? Number(match[1]) : null;
}
export function jobExperience(job) {
  if (Number.isFinite(job.minExperience)) return { min: job.minExperience, max: Number.isFinite(job.maxExperience) ? job.maxExperience : null };
  const text = job.description || '';
  const range = text.match(/(?:experience\s*[:\-]?\s*)?(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)?/i);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const minimum = text.match(/(?:minimum|at least)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i) || text.match(/\b(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i);
  return minimum ? { min: Number(minimum[1]), max: null } : null;
}
export function experienceFit(profile, job) {
  const candidate = statedExperience(profile.experienceYears ?? profile.experience), required = jobExperience(job);
  if (candidate === null || !required) return { status: 'unknown', label: 'Experience requirement needs review' };
  if (candidate < required.min) return { status: 'outside', label: `Requires ${required.min}+ years; resume states ${candidate}` };
  if (required.max !== null && candidate > required.max) return { status: 'outside', label: `Listed range ${required.min}–${required.max} years; resume states ${candidate}` };
  return { status: 'within', label: `Experience overlaps: ${candidate} years` };
}
export function localities(value) {
  const text = String(value || '').toLowerCase();
  const areas = new Set();
  if (/\bbalewadi\b/.test(text)) areas.add('Balewadi');
  if (/\bbaner\b/.test(text)) areas.add('Baner');
  const name = '\\b(?:hinjewadi|hinjawadi|hijewadi)\\b';
  if (new RegExp(name).test(text)) {
    // Link phase numbers to this locality, not another city's phase in a multi-location listing.
    const join = '[\\s,():-]*(?:it\\s+park[\\s,():-]*)?';
    const token = '(?:iii|ii|i|[123])\\b';
    const phases = `(?:phases?|ph\\.?)[\\s:-]*(${token}(?:\\s*(?:,|/|&|and)\\s*${token})*)`;
    const numbers = { i: 1, ii: 2, iii: 3, 1: 1, 2: 2, 3: 3 };
    for (const pattern of [new RegExp(`${name}${join}${phases}`, 'g'), new RegExp(`\\b${phases}${join}${name}`, 'g')]) {
      for (const match of text.matchAll(pattern)) for (const phase of match[1].match(/\b(?:iii|ii|i|[123])\b/g)) areas.add(`Hinjewadi Phase ${numbers[phase]}`);
    }
    areas.add('Hinjewadi'); // A known locality with no stated phase must stay unclassified by phase.
  }
  if (/\bpune\b|\bpoona\b/.test(text)) areas.add('Pune');
  return [...areas];
}
export function locality(value) { return localities(value)[0] || 'Other / unspecified'; }
export function regionMatch(job, scope = 'local') {
  const areas = localities(job.location);
  if (scope === 'all') return true;
  if (scope === 'pune') return areas.length > 0;
  if (scope === 'local') return areas.some(area => area !== 'Pune');
  if (scope === 'baner-balewadi') return areas.some(area => ['Baner', 'Balewadi'].includes(area));
  if (scope === 'hinjewadi') return areas.includes('Hinjewadi');
  const phase = scope.match(/^hinjewadi-([123])$/)?.[1];
  return Boolean(phase && areas.includes(`Hinjewadi Phase ${phase}`));
}
export function titleFit(profile, job) {
  const title = job.title || '';
  const roles = profile.roles || [];
  if (!roles.length) return true;
  if (roles.some(role => /full.?stack|software engineer/i.test(role)) && /full.?stack|\.net|asp\.?net|software (?:engineer|developer)|react|web (?:application|developer)|front.?end|back.?end/i.test(title)) return true;
  return roles.some(role => title.toLowerCase().includes(role.toLowerCase()));
}
export function naukriSearches(profile) {
  if (!profile) return [];
  const roles = profile.roles?.length ? profile.roles.slice(0, 3) : [];
  const primary = roles.find(x => /Java Developer|\.NET Developer/i.test(x)) || roles.find(x => /full.?stack/i.test(x)) || roles[0] || 'Software Developer';
  const priority = primary.includes('Java') ? ['Java', 'Spring Boot', 'SQL', 'REST APIs'] : primary.includes('.NET') ? ['.NET', 'C#', 'ASP.NET Core', 'SQL Server'] : ['Python', 'React', 'Angular', 'Node.js', 'TypeScript', 'SQL'];
  const allowed = resumeKeywords((profile.skills || []).join(', '));
  const skills = allowed.filter(x => !['Agile', 'Scrum', 'Project Management'].includes(x)).sort((a,b) => (priority.includes(a) ? priority.indexOf(a) : 99) - (priority.includes(b) ? priority.indexOf(b) : 99)).slice(0,4);
  skills.push(...allowed.filter(x => ['Agile', 'Scrum'].includes(x)));
  const experience = statedExperience(profile.experienceYears ?? profile.experience);
  return [...targetRegion.areas, targetRegion.city].map(area => {
    const keyword = [primary, ...skills, ...(area === 'Pune' ? [] : [area])].join(' ');
    const url = new URL('https://www.naukri.com/jobs-in-pune'); url.searchParams.set('k', keyword); url.searchParams.set('l', 'Pune');
    if (experience !== null) url.searchParams.set('experience', String(Math.floor(experience)));
    return { area, keyword, experience, filterYears: experience === null ? null : Math.floor(experience), url: url.href };
  });
}
