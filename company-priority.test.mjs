import test from 'node:test';
import assert from 'node:assert/strict';
import { mncCompany, normalizeEmployer, orderCompanyJobs } from './src/features/employers/utils/company-priority.mjs';

test('major employers recognize curated aliases and common legal suffixes', () => {
  for (const [employer, expected] of [
    ['Tata Consultancy Services Limited', 'TCS'],
    ['IBM India Pvt. Ltd.', 'IBM'],
    ['Infosys Technologies Ltd', 'Infosys'],
    ['HCL Technologies (India) Private Limited', 'HCLTech'],
    ['  ACCENTURE SOLUTIONS PRIVATE LIMITED  ', 'Accenture']
  ]) assert.equal(mncCompany(employer)?.name, expected, employer);
  assert.equal(normalizeEmployer('IBM India Pvt. Ltd.'), 'ibm');
});

test('unrecognized employers and recruiter/client mentions stay unclassified', () => {
  for (const employer of ['', undefined, 'Acme hiring for Microsoft', 'IBM recruitment partners', 'Sapling Technologies', 'Persistent Staffing']) {
    assert.equal(mncCompany(employer), null, String(employer));
  }
});

test('MNC priority and exclusive filters retain locality and fit ranking without mutating jobs', () => {
  const job = (id, company, location, rank) => ({ id, company, location, title: 'Software Developer', analysis: { rank } });
  const jobs = [job('other-pune', 'Example Ltd', 'Pune', 90), job('mnc-pune', 'TCS', 'Pune', 20), job('mnc-local', 'Infosys', 'Baner, Pune', 10), job('other-local', 'Another Ltd', 'Balewadi, Pune', 90)];
  const ids = mode => orderCompanyJobs(jobs, mode).map(x => x.id);
  assert.deepEqual(ids('mnc-first'), ['mnc-local', 'mnc-pune', 'other-local', 'other-pune']);
  assert.deepEqual(ids('match'), ['other-local', 'other-pune', 'mnc-local', 'mnc-pune']);
  assert.deepEqual(ids('mnc-only'), ['mnc-local', 'mnc-pune']);
  assert.deepEqual(ids('other-only'), ['other-local', 'other-pune']);
  assert.deepEqual(jobs.map(x => x.id), ['other-pune', 'mnc-pune', 'mnc-local', 'other-local']);
  const phaseJobs = [job('other-phase', 'Example Ltd', 'Hinjawadi Phase 2', 80), job('mnc-pune', 'TCS', 'Pune', 20), job('mnc-phase', 'IBM', 'Hinjewadi Phase 3', 10)];
  assert.deepEqual(orderCompanyJobs(phaseJobs).map(x => x.id), ['mnc-phase', 'mnc-pune', 'other-phase']);
});
