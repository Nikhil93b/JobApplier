import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProfile, jobAnalysis, tailorResume, estimateExperience } from './src/features/resume/utils/resume.mjs';
const original = 'Asha Patel\nasha@example.com\nLocation: Bengaluru\nSoftware Engineer\n5 years of experience\nSkills: Java, Python, SQL\nExperience\nBuilt Python and SQL reporting tools for an operations team.\nEducation\nBachelor of Engineering';
test('upload-only extraction finds supported information without inventing preferences', () => {
  const profile = extractProfile(original);
  assert.equal(profile.name, 'Asha Patel'); assert.equal(profile.email, 'asha@example.com'); assert.equal(profile.location, 'Bengaluru'); assert.equal(profile.experience, '5 years of experience'); assert.deepEqual(profile.skills, ['Python', 'Java', 'SQL']); assert.deepEqual(profile.roles, ['Java Developer', 'Software Engineer']); assert.equal(profile.rolesInferred, false);
  assert.equal(extractProfile('Priya Sharma\nJavaScript React projects and HTML CSS applications').rolesInferred, true);
  assert.equal(extractProfile('Priya Sharma\nPython projects').location, '');
  assert.deepEqual(profile.sections.Education, ['Bachelor of Engineering']);
  assert.equal(extractProfile(original + '\nPhone: 9876543210').phone, '9876543210');
});
test('job ranking favors overlapping evidence and does not treat generic communication as a fit', () => {
  const profile = extractProfile(original);
  const fit = jobAnalysis(profile, { title: 'Software Engineer', description: 'Python SQL AWS' });
  assert.equal(fit.relevant, true); assert.deepEqual(fit.missing, ['AWS']);
  assert.equal(jobAnalysis({ skills: ['Communication'], roles: [] }, { title: 'Nurse', description: 'Good communication required' }).relevant, false);
});
test('tailoring preserves facts, surfaces evidence, and never inserts missing skills', () => {
  const result = tailorResume(original, extractProfile(original), { title: 'Data Analyst', description: 'Python SQL AWS' });
  assert.match(result.text, /Skills: Python, SQL, Java/); assert.equal(result.text.includes('AWS'), false); assert.equal(result.evidence.length, 1); assert.equal(result.changes.length, 1);
  assert.equal(result.text.replace('Skills: Python, SQL, Java', 'Skills: Java, Python, SQL'), original);
});
test('Word-style headings with spaced colons expose work sections and inline address', () => {
  const profile = extractProfile('Asha Patel\nSoftware Developer\nEmail: asha@example.com | Address : Satara, Maharashtra\nSKILLS :\nC#, .NET\nPROFESSIONAL EXPERIENCE :\nExample Company\nJan 2023 - Current\nBuilt reporting applications.\nPERSONAL PROJECTS :\nEcommerce application\nEDUCATION :\nBachelor degree\nJune 2016 - Dec 2020', { asOf: new Date('2026-10-15T00:00:00Z') });
  assert.equal(profile.location, 'Satara, Maharashtra'); assert.equal(profile.experienceYears, 3.8); assert.equal(profile.experienceSource, 'dates');
  assert.deepEqual(Object.keys(profile.sections), ['Skills', 'Experience', 'Projects', 'Education']);
  assert.ok(profile.warnings.some(x => x.includes('estimated')));
});
test('experience estimates merge overlapping jobs and exclude education', () => {
  assert.equal(estimateExperience(['Jan 2023 - Dec 2023', 'Jun 2023 - Dec 2023'], new Date('2026-10-15T00:00:00Z')), 1);
  const explicit = extractProfile('Asha Patel\n3.8 years of experience\nPROFESSIONAL EXPERIENCE :\nJan 2023 - Current\nEDUCATION :\nJan 2010 - Dec 2015');
  assert.equal(explicit.experienceYears, 3.8); assert.equal(explicit.experienceSource, 'stated');
  assert.equal(extractProfile('Asha Patel\nEDUCATION :\nJan 2010 - Dec 2015').experienceYears, null);
});


test('resume keywords retain technical skills and delivery processes and reject generic business skills', () => {
  const profile = extractProfile('Java Candidate\nJava Developer\nJava, Spring Boot, Agile, Scrum, Communication, Leadership, Sales, Recruitment');
  assert.ok(profile.skills.includes('Agile')); assert.ok(profile.skills.includes('Scrum'));
  for (const keyword of ['Communication', 'Leadership', 'Sales', 'Recruitment']) assert.ok(!profile.skills.includes(keyword));
  assert.equal(jobAnalysis(profile, { title: '.NET Developer', description: 'SQL, Agile, Scrum and .NET' }).relevant, false);
});
