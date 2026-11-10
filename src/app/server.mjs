import http from 'node:http';
import { fetchNaukri, fetchNaukriDetail } from '../services/integrations/naukri/naukri.mjs';
import { aiService } from '../services/integrations/codex-ai.mjs';
import { json } from '../services/api/http.mjs';
import { routeApiRequest } from './routes/api.mjs';
import { serveStaticFile } from './routes/static.mjs';
export const appVersion = '2026.10.22.1';
export const apiVersion = 3;

export function createAppServer({ ai = aiService, naukri = fetchNaukri, naukriDetail = fetchNaukriDetail, recordDiagnostics = ai === aiService } = {}) {
  const services = { ai, naukri, naukriDetail, recordDiagnostics };
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) { json(res, 403, { error: 'Use this application from its local page.' }); return; }
        if (url.pathname.startsWith('/api/ai/') || url.pathname === '/api/naukri' || url.pathname === '/api/naukri/detail') {
          if (!/^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(req.headers.host || '') || req.headers['sec-fetch-site'] === 'cross-site' || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) { json(res, 403, { error: 'Use job discovery and AI from this app’s local page.' }); return; }
        }
      }
      if (req.method === 'GET' && url.pathname === '/api/health') { json(res, 200, { app: 'job-applier', version: appVersion, apiVersion }); return; }
      if (await routeApiRequest(req, res, url, services)) return;
      if (req.method !== 'GET') { json(res, 405, { error: 'Method not allowed.' }); return; }
      await serveStaticFile(url.pathname, res);
    } catch (error) {
      console.error(`${url.pathname}: ${error.name}`);
      if (!res.headersSent) json(res, error.status || (req.method === 'POST' ? 400 : 502), { error: error.name === 'TimeoutError' ? 'Career board timed out. Try again.' : error.name === 'SyntaxError' ? 'Invalid request data.' : error.message === 'fetch failed' ? 'Cannot reach the career board. Check your internet connection.' : error.message }); else res.end();
    }
  });
}
