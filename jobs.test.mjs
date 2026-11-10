import test from 'node:test';
import assert from 'node:assert/strict';
import { findJob, updateJob } from './src/shared/utils/jobs.mjs';
const job = () => ({ id: 'saved', title: 'Developer', company: 'Employer', description: 'Original full job description', url: 'https://www.naukri.com/job-listings-test-123', partialDescription: false, selected: true, status: 'Interview', tailored: { text: 'Original draft', approved: true }, aiReview: { summary: 'Old evidence' } });
test('changed job requirements archive old approved drafts and invalidate AI review', () => {
  const previous = job(); updateJob(previous, { description: 'Changed requirements', partialDescription: false });
  assert.equal(previous.tailored, undefined); assert.equal(previous.aiReview, undefined); assert.equal(previous.previousTailored.length, 1);
  assert.equal(previous.selected, true); assert.equal(previous.status, 'Interview'); assert.equal(previous.id, 'saved');
});
test('metadata refresh and partial summaries preserve a complete JD and its review', () => {
  const previous = job(); updateJob(previous, { description: 'Partial overview', partialDescription: true, checkedAt: '2026-10-15' });
  assert.equal(previous.description, 'Original full job description'); assert.equal(previous.partialDescription, false); assert.equal(previous.tailored.approved, true);
});
test('Naukri browser captures update manually imported URLs without duplicate applications', () => {
  const previous = { ...job(), source: 'Naukri (manual import)' };
  assert.equal(findJob([previous], { source: 'Naukri', sourceId: '/job-listings-test-123', url: previous.url + '?src=search', title: 'Renamed role' }), previous);
  assert.equal(findJob([{ ...previous, url: 'https://employer.example/careers', title: 'Role A' }], { url: 'https://employer.example/careers', title: 'Role B' }), undefined);
});
