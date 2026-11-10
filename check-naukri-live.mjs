import { fetchNaukri, fetchNaukriDetail } from './src/services/integrations/naukri/naukri.mjs';
import { extractProfile } from './src/features/resume/utils/resume.mjs';
import { readResume } from './src/features/resume/services/documents.mjs';
import { readFile } from 'node:fs/promises';
const path = process.env.JOB_APPLIER_TEST_RESUME;
const profile = path ? extractProfile(await readResume(await readFile(path), path)) : { roles: ['Software Engineer'], skills: ['C#', '.NET', 'SQL'], experienceYears: 3.8 };
const result = await fetchNaukri(profile);
const report = { test: 'real Naukri search and full JD; no fixtures', search: result.status, records: result.jobs.length, message: result.message, passed: false };
if (result.status === 'available' && result.jobs.length) {
  const detail = await fetchNaukriDetail(result.jobs[0].url);
  report.detail = detail.status; report.passed = detail.status === 'available' && detail.job?.partialDescription === false && detail.job.description.length >= 80;
}
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
