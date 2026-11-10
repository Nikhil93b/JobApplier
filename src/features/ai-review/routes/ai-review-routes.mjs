import { json, body } from '../../../services/api/http.mjs';

export async function handleAIReviewRoutes(req, res, url, { ai }) {
  if (req.method === 'POST') {
    if (url.pathname === '/api/ai/status' || url.pathname === '/api/ai/analyze') {
      const input = JSON.parse((await body(req, 512 * 1024)).toString('utf8'));
      json(res, 200, url.pathname.endsWith('/status') ? await ai.status() : await ai.analyze(input)); return true;
    }
  }
  return false;
}
