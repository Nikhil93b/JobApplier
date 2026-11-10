export function naukriJobUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['www.naukri.com', 'naukri.com'].includes(url.hostname) || url.port || url.username || url.password || !/^\/job-listings-[a-z0-9%._~-]+\/?$/i.test(url.pathname) || url.pathname.length > 800) return null;
    return `https://www.naukri.com${url.pathname}`;
  } catch { return null; }
}

// Runs in the page: reads rendered public DOM, without evaluating site-provided code.
export function naukriSnapshot() {
  const text = node => node?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const pick = (node, selectors) => { for (const selector of selectors) { const value = text(node.querySelector(selector)); if (value) return value; } return ''; };
  const cards = [];
  for (const a of document.querySelectorAll('a[href*="/job-listings-"]')) {
    const title = text(a) || a.getAttribute('title') || '';
    if (!title) continue;
    let card = a.closest('.srp-jobtuple-wrapper, .cust-job-tuple, .jobTuple, [data-job-id], article');
    if (!card) {
      card = a.parentElement;
      for (let i = 0; i < 4 && card?.parentElement; i++) {
        const links = [...card.parentElement.querySelectorAll('a[href*="/job-listings-"]')];
        if (new Set(links.map(link => link.href)).size > 1) break;
        card = card.parentElement;
      }
    }
    if (!card) continue;
    cards.push({ url: a.href, title, company: pick(card, ['.comp-name', '.companyInfo a', '[class*="companyName"]', '[itemprop="hiringOrganization"]']),
      location: pick(card, ['.locWdth', '.loc-wrap', '[class*="location"]', '[itemprop="jobLocation"]']),
      experience: pick(card, ['.expwdth', '.exp-wrap', '[class*="experience"]']),
      overview: pick(card, ['.job-desc', '.job-description', '[class*="jobDesc"]']),
      skills: pick(card, ['.tags-gt', '.tags', '[class*="skill"]']) });
  }
  let description = '', structured = null;
  function visit(value) {
    if (!value || typeof value !== 'object' || structured) return;
    if ([value['@type']].flat().includes('JobPosting')) { structured = value; return; }
    Object.values(value).forEach(visit);
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) { try { visit(JSON.parse(script.textContent)); } catch {} }
  for (const selector of ['[itemprop="description"]', '[class*="dang-inner-html"]', '.jd-desc', '.job-description', '#job-description']) {
    const node = document.querySelector(selector); if (node && text(node).length >= 80) { description = node.innerText || node.textContent; break; }
  }
  if (!description) for (const heading of document.querySelectorAll('h2, h3')) {
    if (/^job description$/i.test(text(heading))) {
      const node = heading.nextElementSibling;
      if (node && text(node).length >= 80) { description = node.innerText || node.textContent; break; }
    }
  }
  if (!description && typeof structured?.description === 'string') {
    const template = document.createElement('template'); template.innerHTML = structured.description;
    template.content.querySelectorAll('script,style,iframe').forEach(node => node.remove());
    template.content.querySelectorAll('p,div,li,br').forEach(node => node.append('\n'));
    if (text(template.content).length >= 80) description = template.content.textContent;
  }
  const heading = pick(document, ['h1']) || (typeof structured?.title === 'string' ? structured.title : '');
  const company = pick(document, ['[class*="jd-header-comp-name"] a', '.company-name', '[itemprop="hiringOrganization"]']) || (typeof structured?.hiringOrganization?.name === 'string' ? structured.hiringOrganization.name : '');
  const location = pick(document, ['[class*="loc__"]', '.location', '[itemprop="jobLocation"]']);
  return { cards, description: description.trim(), heading, company, location, title: document.title,
    body: (document.body?.innerText || document.body?.textContent || '').slice(0, 12000) };
}

export function normalizeNaukriCards(cards) {
  const jobs = new Map(), checkedAt = new Date().toISOString().slice(0, 10);
  for (const card of Array.isArray(cards) ? cards.slice(0, 200) : []) {
    if (!card || typeof card.title !== 'string' || typeof card.company !== 'string') continue;
    const url = naukriJobUrl(card.url); if (!url || !card.title.trim() || !card.company.trim() || card.title.length > 300 || card.company.length > 300) continue;
    const experience = (typeof card.experience === 'string' ? card.experience.slice(0, 100) : '').match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)/i);
    jobs.set(url, { sourceId: new URL(url).pathname, source: 'Naukri', title: card.title.trim(), company: card.company.trim(), location: typeof card.location === 'string' ? card.location.slice(0, 500) : '', url,
      description: [typeof card.overview === 'string' ? card.overview.slice(0, 10000) : '', typeof card.experience === 'string' ? `Experience: ${card.experience.slice(0, 100)}` : '', typeof card.skills === 'string' ? `Listed skills: ${card.skills.slice(0, 3000)}` : ''].filter(Boolean).join('\n'),
      ...(experience ? { minExperience: Number(experience[1]), maxExperience: Number(experience[2]) } : {}),
      partialDescription: true, evidenceLevel: 'Live browser-rendered Naukri listing', checkedAt });
  }
  return [...jobs.values()].slice(0, 20);
}

export function naukriPageState(status, snapshot, detail = false) {
  const title = String(snapshot.title || ''), body = String(snapshot.body || '');
  if ([401, 403, 429].includes(status) || /^(?:access denied|security check|captcha|verify (?:you are|that you)|just a moment)[.!\s-]*$/i.test(title.trim()) || /^(?:access denied|please (?:complete|solve) (?:the )?captcha|verify (?:you are|that you are) (?:a )?human|we have detected unusual traffic)\b/i.test(body.trim().slice(0, 500))) return 'blocked';
  if (status >= 400) return 'unavailable';
  if (detail && /job (?:has )?expired|job (?:is )?no longer available|job (?:has been )?removed/i.test(snapshot.body)) return 'expired';
  if (!detail && /no (?:jobs|results) found|could(?:n.t| not) find any jobs|0 jobs found/i.test(snapshot.body)) return 'empty';
  return 'ready';
}

