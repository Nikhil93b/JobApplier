import test from 'node:test';
import assert from 'node:assert/strict';
import { exportResume, readResume } from './src/features/resume/services/documents.mjs';
const resume = 'Asha Patel\nasha@example.com\nSoftware Engineer\nSkills: Python, SQL\nExperience\nBuilt reporting applications using Python and SQL.';
test('Word exports can be read back with all resume facts', async () => {
  const buffer = await exportResume(resume, 'docx'); assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const text = await readResume(buffer, 'resume.docx'); for (const line of resume.split('\n')) assert.ok(text.includes(line));
});
test('PDF exports can be read back with all resume facts', async () => {
  const buffer = await exportResume(resume, 'pdf'); assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  const text = await readResume(buffer, 'resume.pdf'); for (const line of resume.split('\n')) assert.ok(text.includes(line));
});
test('invalid files and short documents produce actionable errors', async () => {
  await assert.rejects(readResume(Buffer.from('fake pdf'), 'resume.pdf'), /valid PDF/);
  await assert.rejects(readResume(Buffer.from('fake word'), 'resume.docx'), /valid Word/);
  await assert.rejects(readResume(Buffer.from('tiny'), 'resume.txt'), /readable text/);
  await assert.rejects(readResume(Buffer.from(resume), 'resume.doc'), /older .doc/);
});
