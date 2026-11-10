import { regionMatch } from '../../../shared/utils/pune.mjs';

// A curated preference group, not an exhaustive MNC register or employer-quality ranking.
// Classification uses the listed employer only, never a client mentioned in its JD.
export const priorityListCheckedAt = '2026-10-17';
export const majorEmployers = [
  { name: 'TCS', aliases: ['TCS', 'Tata Consultancy Services', 'Tata Consultancy Services TCS'], source: 'https://www.tcs.com/investor-relations/investor-faqs' },
  { name: 'Infosys', aliases: ['Infosys', 'Infosys BPM', 'Infosys Technologies'], source: 'https://www.infosys.com/about/' },
  { name: 'Accenture', aliases: ['Accenture', 'Accenture Solutions', 'Accenture Services'], source: 'https://www.accenture.com/en/about/company-index' },
  { name: 'Capgemini', aliases: ['Capgemini', 'Capgemini Technology Services', 'Capgemini Engineering'], source: 'https://www.capgemini.com/about-us/' },
  { name: 'Cognizant', aliases: ['Cognizant', 'Cognizant Technology Solutions'], source: 'https://www.cognizant.com/us/en/about-cognizant' },
  { name: 'Wipro', aliases: ['Wipro', 'Wipro Technologies'], source: 'https://www.wipro.com/about-us/' },
  { name: 'HCLTech', aliases: ['HCLTech', 'HCL Tech', 'HCL Technologies'], source: 'https://www.hcltech.com/about-us' },
  { name: 'IBM', aliases: ['IBM', 'International Business Machines'], source: 'https://www.ibm.com/about' },
  { name: 'Tech Mahindra', aliases: ['Tech Mahindra'], source: 'https://www.techmahindra.com/about-us/' },
  { name: 'Persistent Systems', aliases: ['Persistent', 'Persistent Systems'], source: 'https://www.persistent.com/company-overview/' },
  { name: 'EPAM', aliases: ['EPAM', 'EPAM Systems'], source: 'https://www.epam.com/about' },
  { name: 'NTT DATA', aliases: ['NTT DATA', 'NTT DATA Services', 'NTT DATA Business Solutions'], source: 'https://www.nttdata.com/global/en/about-us' },
  { name: 'Microsoft', aliases: ['Microsoft', 'Microsoft Corporation', 'Microsoft India R D', 'Microsoft India Development Center'], source: 'https://www.microsoft.com/en-us/about' },
  { name: 'Google', aliases: ['Google', 'Google India'], source: 'https://about.google/' },
  { name: 'Amazon', aliases: ['Amazon', 'Amazon Development Centre', 'Amazon Development Center', 'Amazon Web Services', 'AWS'], source: 'https://www.aboutamazon.com/about-us' },
  { name: 'Oracle', aliases: ['Oracle', 'Oracle Financial Services Software', 'Oracle Solution Services'], source: 'https://www.oracle.com/corporate/' },
  { name: 'SAP', aliases: ['SAP', 'SAP Labs'], source: 'https://www.sap.com/about.html' },
  { name: 'Salesforce', aliases: ['Salesforce', 'Salesforce com'], source: 'https://www.salesforce.com/company/' },
  { name: 'Deloitte', aliases: ['Deloitte', 'Deloitte Consulting', 'Deloitte USI', 'Deloitte Touche Tohmatsu', 'Deloitte Support Services', 'Deloitte Consulting India'], source: 'https://www.deloitte.com/global/en/about.html' },
  { name: 'Dell', aliases: ['Dell', 'Dell Technologies', 'Dell International Services'], source: 'https://www.dell.com/en-us/dt/corporate/about-us.htm' }
];
const suffixes = new Set(['private', 'pvt', 'limited', 'ltd', 'incorporated', 'inc', 'corporation', 'corp', 'llp', 'plc', 'india']);
export function normalizeEmployer(value) {
  const words = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/);
  while (words.length && suffixes.has(words.at(-1))) words.pop();
  return words.join(' ');
}
const recognized = new Map(majorEmployers.flatMap(company => company.aliases.map(alias => [normalizeEmployer(alias), company])));
export function mncCompany(employer) { return recognized.get(normalizeEmployer(employer)) || null; }
export const companyOrders = ['mnc-first', 'match', 'mnc-only', 'other-only'];
export function orderCompanyJobs(jobs, mode = 'mnc-first') {
  const annotated = jobs.map(job => ({ job, mnc: Boolean(mncCompany(job.company)) }));
  const selected = annotated.filter(x => mode === 'mnc-only' ? x.mnc : mode === 'other-only' ? !x.mnc : true);
  const rank = job => job.aiFit ? job.aiFit.score : (regionMatch(job, 'local') ? 40 : 0) + (job.analysis?.rank || 0);
  return selected.sort((a, b) => (mode === 'mnc-first' ? Number(b.mnc) - Number(a.mnc) : 0) || rank(b.job) - rank(a.job)).map(x => x.job);
}
