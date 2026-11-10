import { json, body } from '../../../services/api/http.mjs';
import { readResume, exportResume } from '../services/documents.mjs';
import { extractProfile } from '../utils/resume.mjs';

export async function handleResumeRoutes(req, res, url) {
  if (req.method === 'POST') {
    if (url.pathname === '/api/resume') { const text = await readResume(await body(req, 10 * 1024 * 1024), url.searchParams.get('filename') || ''); json(res, 200, { text, profile: extractProfile(text) }); return true; }
    if (url.pathname === '/api/export') {
      const input = JSON.parse((await body(req, 1024 * 1024)).toString('utf8'));
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 100000 || !['pdf', 'docx'].includes(input.format)) { json(res, 400, { error: 'Provide resume text and select PDF or Word.' }); return true; }
      const data = await exportResume(input.text, input.format);
      res.writeHead(200, { 'Content-Type': input.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="tailored-resume.${input.format}"`, 'Cache-Control': 'no-store' }); res.end(data); return true;
    }
  }
  return false;
}
