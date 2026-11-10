import { chromium } from 'playwright-core';

export async function launchAppBrowser() {
  const channel = process.env.JOB_APPLIER_BROWSER || (process.platform === 'win32' ? 'chrome' : 'chromium');
  if (!['chrome', 'msedge', 'chromium'].includes(channel)) throw new Error('JOB_APPLIER_BROWSER must be chrome, msedge or chromium.');
  try { return await chromium.launch({ channel, headless: true, chromiumSandbox: true, timeout: 15000 }); }
  catch { throw new Error('Cannot start the job browser. Install Chrome or Edge, or set JOB_APPLIER_BROWSER=msedge, then retry.'); }
}
