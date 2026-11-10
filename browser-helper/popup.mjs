import { naukriSnapshot } from './naukri-page.mjs';
import { makeNaukriCapture, encodeNaukriCapture } from './naukri-capture.mjs';
const $ = id => document.getElementById(id); let captured;
$('capture').addEventListener('click', async () => {
  $('capture').disabled = true; $('send').hidden = true; $('status').textContent = 'Reading job data from this tab…'; $('preview').replaceChildren(); captured = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab?.url);
    if (url.protocol !== 'https:' || !['www.naukri.com', 'naukri.com'].includes(url.hostname)) throw new Error('Select a Naukri results or job-description tab, then open this helper again.');
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: naukriSnapshot });
    captured = makeNaukriCapture(result.result, tab.url);
    const list = document.createElement('ul');
    for (const job of captured.jobs) { const li = document.createElement('li'); li.textContent = `${job.title} · ${job.company} · ${job.partialDescription ? 'partial JD' : 'complete JD'}`; list.append(li); }
    $('preview').append(list); $('send').hidden = false; $('status').textContent = `${captured.jobs.length} job(s) captured. Review them in Job Applier before importing.`;
  } catch (error) { $('status').textContent = error.message; }
  finally { $('capture').disabled = false; }
});
$('open').addEventListener('click', async () => {
  if (!captured) return;
  try {
    const url = new URL($('destination').value);
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use the local app address, such as http://localhost:3000.');
    url.hash = 'naukri-import=' + encodeNaukriCapture(captured);
    await chrome.tabs.create({ url: url.href }); $('status').textContent = 'Job Applier opened. Review and confirm the captured jobs there.';
  } catch (error) { $('status').textContent = error.message; }
});
$('download').addEventListener('click', () => {
  if (!captured) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(captured, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'naukri-page-capture.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
