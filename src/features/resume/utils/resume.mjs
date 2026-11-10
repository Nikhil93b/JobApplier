import { resumeKeywords } from '../../../shared/utils/match.mjs';
import { statedExperience } from '../../../shared/utils/pune.mjs';

const rolePatterns = [
  ['Full Stack Developer', /\bfull[ -]?stack(?: software)? (?:engineer|developer)\b/i],
  ['Software Engineer', /\b(?:(?:software|full[ -]?stack) (?:development )?(?:engineer|developer)|sde)\b/i],
  ['Frontend Developer', /\bfront[ -]?end (?:engineer|developer)\b/i],
  ['Backend Developer', /\bback[ -]?end (?:engineer|developer)\b/i],
  ['Data Analyst', /\b(?:data|business intelligence) analyst\b/i],
  ['Business Analyst', /\bbusiness analyst\b/i], ['Data Scientist', /\bdata scientist\b/i],
  ['DevOps Engineer', /\b(?:devops|site reliability) engineer\b/i],
  ['Product Manager', /\bproduct manager\b/i], ['Project Manager', /\bproject manager\b/i],
  ['Designer', /\b(?:ux|ui|product|graphic) designer\b/i],
  ['Accountant', /\baccountant\b/i], ['Sales', /\bsales (?:executive|manager|representative)\b/i],
  ['Marketing', /\b(?:digital )?marketing (?:executive|manager|specialist)\b/i],
  ['Recruiter', /\b(?:recruiter|talent acquisition)\b/i], ['QA Engineer', /\b(?:qa|quality assurance|test) engineer\b/i]
];
const monthNames = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
export function estimateExperience(lines, asOf = new Date()) {
  const value = lines.join('\n');
  const pattern = new RegExp(`(${monthNames})\\.?\\s+(\\d{4})\\s*(?:-|–|—|to)\\s*(?:(${monthNames})\\.?\\s+(\\d{4})|(current|present|now))`, 'gi');
  const month = name => ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(name.slice(0, 3).toLowerCase());
  const today = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth() + (asOf.getUTCDate() - 1) / 31;
  const periods = [...value.matchAll(pattern)].map(m => ({ start: Number(m[2]) * 12 + month(m[1]), end: m[5] ? today : Number(m[4]) * 12 + month(m[3]) + 1 })).filter(p => p.start <= today && p.end > p.start).sort((a,b) => a.start - b.start);
  if (!periods.length) return null;
  const merged = [];
  for (const p of periods) { const previous = merged.at(-1); if (previous && p.start <= previous.end) previous.end = Math.max(previous.end, Math.min(p.end, today)); else merged.push({ ...p, end: Math.min(p.end, today) }); }
  return Math.round(merged.reduce((months, p) => months + p.end - p.start, 0) / 12 * 10) / 10;
}
export function extractProfile(text, { asOf = new Date() } = {}) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const known = resumeKeywords(text);
  const name = lines.slice(0, 8).find(x => /^[\p{L} .'-]{3,65}$/u.test(x) && x.split(/\s+/).length >= 2 && !/resume|curriculum|vitae|profile|engineer|developer|analyst|skills|summary|experience|manager/i.test(x)) || '';
  let roles = rolePatterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const specific = known.includes('Java') ? 'Java Developer' : known.some(x => ['.NET', 'C#'].includes(x)) ? '.NET Developer' : null;
  if (specific) roles.unshift(specific);
  const rolesInferred = !rolePatterns.some(([, pattern]) => pattern.test(text));
  if (!roles.length) {
    if (known.some(x => ['React', 'Angular', 'Vue', 'JavaScript'].includes(x))) roles.push('Frontend Developer');
    if (known.some(x => ['Node.js', 'Java', 'Django', 'FastAPI'].includes(x))) roles.push('Software Engineer');
    if (known.some(x => ['Power BI', 'Tableau', 'Data Analysis'].includes(x))) roles.push('Data Analyst');
    if (known.some(x => ['Kubernetes', 'Docker', 'AWS'].includes(x))) roles.push('DevOps Engineer');
  }
  const labeledLocation = text.match(/(?:^|\n)\s*(?:location|address|based in)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim() || '';
  const experience = text.match(/\b\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)\s*(?:(?:of|in|professional|total|relevant|work)\s+){0,3}experience\b/i)?.[0] || '';
  const sections = {}; let current = '';
  for (const line of lines) {
    const label = line.replace(/\s*[:：]\s*$/, '').trim().toLowerCase();
    const section = { experience: 'Experience', 'work experience': 'Experience', 'professional experience': 'Experience', education: 'Education', projects: 'Projects', 'personal projects': 'Projects', achievements: 'Achievements', certifications: 'Certifications', summary: 'Summary', 'professional summary': 'Summary', skills: 'Skills', 'technical skills': 'Skills' }[label];
    if (section) { current = section; sections[current] ||= []; } else if (current) sections[current].push(line);
  }
  const phone = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-])?\d{3,5}[\s-]\d{4,6}\b/)?.[0] || text.match(/(?:^|[\s:|])((?:\+\d{1,3}[\s-]?)?\d{10})(?=$|[\s|,])/m)?.[1] || '';
  const explicitYears = statedExperience(text);
  const years = explicitYears ?? estimateExperience(sections.Experience || [], asOf);
  const experienceSource = explicitYears !== null ? 'stated' : years !== null ? 'dates' : 'unknown';
  const inlineLocation = text.match(/(?:^|[|\n])\s*(?:location|address|based in)\s*[:\-]\s*([^|\n]+)/i)?.[1]?.trim() || '';
  const warnings = [];
  if (experienceSource === 'dates') warnings.push('Experience is estimated from employment month ranges. Verify that any role marked Current/Present is still current; dates are not independently verified.');
  if (/\bReat\b/i.test(text)) warnings.push('Your document contains “Reat”. If this means React, correct it in the resume text; it has not been counted as a verified React skill.');
  if (experienceSource === 'unknown') warnings.push('Experience could not be determined from a stated total or recognizable work dates. You can correct it in the optional profile fields.');
  return { name, email: text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '', phone, skills: known, roles, rolesInferred, location: labeledLocation || inlineLocation, experience: experience || (years === null ? '' : `${experienceSource === 'dates' ? 'About ' : ''}${years} years ${experienceSource === 'dates' ? '(estimated from dates)' : 'stated'}`), experienceYears: years, experienceSource, sections, warnings, extractedAt: new Date().toISOString() };
}
export { jobAnalysis, tailorResume } from '../../tailoring/utils/tailor-resume.mjs';
