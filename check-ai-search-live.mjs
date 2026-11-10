import { createAIService, openCodex } from './src/services/integrations/codex-ai.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
const dotnet = process.argv.includes('--dotnet');
const report = { syntheticResume: true, stack: dotnet ? 'dotnet' : 'java', startedAt: new Date().toISOString() };
report.webEvents = [];
const ai = createAIService(async () => {
  const connection = await openCodex();
  connection.subscribe(event => {
    if (event.method === 'item/completed' && event.params?.item?.type === 'webSearch') report.webEvents.push(event.params.item);
    if (event.method === 'item/completed' && event.params?.item?.type === 'agentMessage') report.lastOutput = event.params.item.text;
  });
  return connection;
});
try {
  report.status = await ai.status();
  console.log(JSON.stringify({ stage: 'connection', ...report.status }));
  if (!report.status.ready) throw new Error(report.status.message);
  const resume = dotnet
    ? 'Example Candidate\n.NET Full Stack Developer\n3.8 years of professional experience\nTechnical Skills\nC#, .NET, ASP.NET Core, SQL Server, React, REST APIs, Git, Agile, Scrum\nProfessional Experience\n.NET Developer, Example Company, January 2023 to October 2026\nBuilt and maintained C# ASP.NET Core REST APIs, SQL Server databases and React interfaces. Delivered applications using Agile and Scrum.'
    : 'Example Candidate\nJava Backend Developer\n4 years of professional experience\nTechnical Skills\nJava, Spring Boot, REST APIs, PostgreSQL, Git, Agile, Scrum\nProfessional Experience\nBackend Developer, Example Company, October 2022 to October 2026\nBuilt and maintained Java Spring Boot REST APIs backed by PostgreSQL. Delivered services using Agile and Scrum.';
  const result = await ai.planSearch({ resume });
  report.plan = result.plan;
  console.log(JSON.stringify({ stage: 'analysis', roles: result.plan.roles.map(x => x.title), keywords: result.plan.keywords.map(x => x.name) }));
  report.search = await ai.searchJobs(result);
  console.log(JSON.stringify({ stage: 'search', count: report.search.jobs.length, webSearches: report.search.webSearches, discarded: report.search.discarded, summary: report.search.summary }));
  report.searchCompleted = report.search.webSearches > 0;
  report.liveJobsFound = report.search.jobs.length > 0;
  report.passed = report.searchCompleted && report.liveJobsFound;
  if (!report.passed) { report.error = 'Live search completed without supported job results. See summary and diagnostics.'; process.exitCode = 1; }
} catch (error) { report.passed = false; report.error = error.message; console.log(JSON.stringify({ error: error.message })); process.exitCode = 1; }
finally { await mkdir(new URL('./.qa/', import.meta.url), { recursive: true }); report.finishedAt = new Date().toISOString(); await writeFile(new URL('./.qa/ai-search-live-report.json', import.meta.url), JSON.stringify(report, null, 2)); }
