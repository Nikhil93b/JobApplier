const aliases = {
  JavaScript: ['javascript', 'js'], TypeScript: ['typescript', 'ts'], Python: ['python'], Java: ['java'], React: ['react', 'reactjs', 'react.js'],
  'Node.js': ['node', 'nodejs', 'node.js'], SQL: ['sql', 'mysql', 'postgresql', 'postgres'], HTML: ['html', 'html5'], CSS: ['css', 'css3'],
  AWS: ['aws', 'amazon web services'], Azure: ['azure'], Docker: ['docker'], Kubernetes: ['kubernetes', 'k8s'], Git: ['git'],
  Excel: ['excel'], 'Power BI': ['power bi', 'powerbi'], Tableau: ['tableau'], 'Machine Learning': ['machine learning'],
  'C++': ['c++'], 'C#': ['c#'], '.NET': ['.net', 'dotnet', 'asp.net'], 'ASP.NET Core': ['asp.net core'], 'Entity Framework': ['entity framework', 'ef core'], 'SQL Server': ['sql server', 'mssql'], 'CI/CD': ['ci/cd', 'continuous integration'], 'Azure DevOps': ['azure devops'], 'React Native': ['react native'], Django: ['django'], Flask: ['flask'], FastAPI: ['fastapi'],
  Angular: ['angular'], Vue: ['vue', 'vue.js'], MongoDB: ['mongodb'], 'REST APIs': ['rest', 'restful'], Figma: ['figma'],
  Salesforce: ['salesforce'], 'Project Management': ['project management'], 'Data Analysis': ['data analysis', 'data analytics'],
  'Financial Reporting': ['financial reporting'], Accounting: ['accounting'], Tally: ['tally'], SAP: ['sap'],
  Marketing: ['marketing'], SEO: ['seo', 'search engine optimization'], Sales: ['sales'], Recruitment: ['recruitment', 'recruiting'],
  'Customer Support': ['customer support', 'customer service'], 'Manual Testing': ['manual testing'], Selenium: ['selenium'],
  'Agile': ['agile'], 'Scrum': ['scrum'], 'Communication': ['communication'], 'Leadership': ['leadership'],
  PHP: ['php'], Laravel: ['laravel'], GraphQL: ['graphql'], Terraform: ['terraform'], Unity: ['unity'],
  'Spring Boot': ['spring boot'], Linux: ['linux'], Jenkins: ['jenkins'], Redux: ['redux'], 'Clean Architecture': ['clean architecture'],
  Prometheus: ['prometheus'], Grafana: ['grafana'], 'Azure Blob Storage': ['azure blob storage'], 'Generative AI': ['generative ai', 'genai'], 'OpenAI APIs': ['openai apis', 'openai api']
};
export function skills(text) {
  return Object.entries(aliases).filter(([, names]) => names.some(name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])', 'i').test(text);
  })).map(([name]) => name);
}
export function match(resumeSkills, description) {
  const required = skills(description);
  const matched = required.filter(skill => resumeSkills.includes(skill));
  return { required, matched, missing: required.filter(skill => !resumeSkills.includes(skill)), score: required.length ? Math.round(matched.length / required.length * 100) : null };
}
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

const nonTechnical = new Set(['Communication', 'Leadership', 'Financial Reporting', 'Accounting', 'Tally', 'Marketing', 'SEO', 'Sales', 'Recruitment', 'Customer Support']);
export function resumeKeywords(text) { return skills(text).filter(skill => !nonTechnical.has(skill)); }
