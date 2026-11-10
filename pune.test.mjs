import test from 'node:test';
import assert from 'node:assert/strict';
import { statedExperience, experienceFit, naukriSearches, regionMatch, titleFit, locality } from './src/shared/utils/pune.mjs';
import { extractProfile } from './src/features/resume/utils/resume.mjs';
import { companies, jobLeads } from './src/features/employers/constants/companies.mjs';
test('fractional experience and full-stack .NET profile are extracted without rounding', () => {
  const profile = extractProfile('Example Developer\nFull Stack Software Developer\n3.8 years of experience building C#, ASP.NET Core, React.js and SQL Server applications.');
  assert.equal(profile.experienceYears, 3.8); assert.ok(profile.roles.includes('Full Stack Developer'));
  for (const skill of ['C#', '.NET', 'ASP.NET Core', 'React', 'SQL Server']) assert.ok(profile.skills.includes(skill), skill);
  assert.equal(statedExperience('Total experience: 4.5 years'), 4.5); assert.equal(statedExperience('Employment 2021–2026'), null);
});
test('Naukri searches use Pune, local keywords and experience without contact details', () => {
  const searches = naukriSearches({ name: 'Private Name', email: 'private@example.com', phone: '9876543210', skills: ['C#', '.NET', 'React'], roles: ['Full Stack Developer'], experienceYears: 3.8 });
  assert.deepEqual(searches.map(x => x.area), ['Baner', 'Balewadi', 'Hinjewadi Phase 1', 'Hinjewadi Phase 2', 'Hinjewadi Phase 3', 'Pune']);
  for (const search of searches) { const url = new URL(search.url); assert.equal(url.hostname, 'www.naukri.com'); assert.equal(url.searchParams.get('l'), 'Pune'); assert.equal(url.searchParams.get('experience'), '3'); assert.equal(search.experience, 3.8); assert.equal(search.url.includes('private'), false); assert.equal(search.url.includes('9876543210'), false); }
  for (const search of searches.slice(0, -1)) assert.ok(new URL(search.url).searchParams.get('k').includes(search.area), search.area);
  assert.equal(new URL(naukriSearches({ skills: [], roles: [] })[0].url).searchParams.has('experience'), false);
});
test('experience filtering keeps unknown requirements visible and identifies incompatible ranges', () => {
  const profile = { experienceYears: 3.8 };
  assert.equal(experienceFit(profile, { description: '3–5 years of experience' }).status, 'within');
  assert.equal(experienceFit(profile, { description: 'Minimum 4 years of experience' }).status, 'outside');
  assert.equal(experienceFit(profile, { minExperience: 0, maxExperience: 3 }).status, 'outside');
  assert.equal(experienceFit(profile, { description: 'Experience required' }).status, 'unknown');
});
test('location evidence comes from job location, not footer text', () => {
  assert.equal(regionMatch({ location: 'Baner, Pune' }), true); assert.equal(regionMatch({ location: 'Balewadi, Pune' }), true);
  assert.equal(regionMatch({ location: 'Pune' }), false); assert.equal(regionMatch({ location: 'Pune' }, 'pune'), true);
  assert.equal(regionMatch({ location: 'Bengaluru', description: 'Company office in Baner' }), false);
  assert.equal(titleFit({ roles: ['Full Stack Developer'] }, { title: '.NET Developer' }), true); assert.equal(titleFit({ roles: ['Full Stack Developer'] }, { title: 'Sales Executive' }), false);
});

test('Hinjewadi phases recognize location spelling variants, Roman numerals and phase-first addresses', () => {
  for (const [location, phase] of [
    ['Hinjewadi Phase 1, Pune', 1], ['Hinjawadi Phase-II', 2], ['Hijewadi Phase 3', 3],
    ['Hinjewadi IT Park, Phase III, Pune', 3], ['Phase I, Hinjawadi', 1], ['Hinjewadi Ph. 2', 2]
  ]) {
    assert.equal(locality(location), `Hinjewadi Phase ${phase}`, location);
    assert.equal(regionMatch({ location }, `hinjewadi-${phase}`), true, location);
    assert.equal(regionMatch({ location }, 'local'), true, location);
    assert.equal(regionMatch({ location }, 'pune'), true, location);
  }
});

test('phase filters require explicit phase evidence and keep unknown phases in broader searches', () => {
  for (const location of ['Hinjewadi', 'Hinjawadi, Pune', 'Hinjewadi Phase 12, Pune']) {
    assert.equal(regionMatch({ location }, 'hinjewadi'), true);
    assert.equal(regionMatch({ location }, 'pune'), true);
    for (const phase of [1, 2, 3]) assert.equal(regionMatch({ location }, `hinjewadi-${phase}`), false, location);
  }
  assert.equal(regionMatch({ location: 'Hinjewadi Phase 1' }, 'hinjewadi-2'), false);
  assert.equal(regionMatch({ location: 'Pune', description: 'Office in Hinjewadi Phase 2' }, 'hinjewadi-2'), false);
  assert.equal(regionMatch({ location: 'Hinjewadi Phase 3, Pune' }, 'baner-balewadi'), false);
  assert.equal(regionMatch({ location: 'Baner, Pune' }, 'baner-balewadi'), true);
});

test('multiple listed locations and phase lists match each explicitly supported phase', () => {
  const job = { location: 'Baner, Pune; Hinjawadi Phase 2, Pune' };
  assert.equal(regionMatch(job, 'baner-balewadi'), true);
  assert.equal(regionMatch(job, 'hinjewadi-2'), true);
  assert.equal(regionMatch(job, 'hinjewadi-1'), false);
  for (const location of ['Hinjewadi Phases 1 & 2, Pune', 'Phase I/II, Hinjawadi']) {
    assert.equal(regionMatch({ location }, 'hinjewadi-1'), true);
    assert.equal(regionMatch({ location }, 'hinjewadi-2'), true);
    assert.equal(regionMatch({ location }, 'hinjewadi-3'), false);
  }
  assert.equal(regionMatch({ location: 'Hinjewadi, Pune; Electronic City Phase 1, Bengaluru' }, 'hinjewadi-1'), false);
});
test('research is bounded to selected localities with evidence and honest hiring states', async () => {
  assert.equal(new Set(companies.map(c => c.id)).size, companies.length);
  for (const company of companies) { assert.ok(['Baner', 'Balewadi'].includes(company.area)); assert.ok(company.evidenceUrl.startsWith('https://')); assert.ok(company.notes); assert.equal(company.checkedAt, '2026-10-15'); }
  assert.ok(companies.some(c => c.hiring === 'none')); assert.ok(companies.some(c => c.hiring === 'historical'));
  for (const lead of jobLeads) { assert.ok(companies.some(c => c.id === lead.companyId)); assert.equal(lead.partialDescription, true); }
  assert.ok(jobLeads.every(x => regionMatch(x))); // Historical reference only; production discovery is retired.
});
