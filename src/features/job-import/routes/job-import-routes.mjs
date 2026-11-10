import { json, body } from '../../../services/api/http.mjs';
import { boardToken } from '../utils/discovery.mjs';
import { fetchBoard } from '../services/sources.mjs';

export async function handleJobImportRoutes(req, res, url, { naukri, naukriDetail }) {
  if (req.method === 'POST') {
    if (url.pathname === '/api/naukri/detail') {
      const input = JSON.parse((await body(req, 4096)).toString('utf8'));
      json(res, 200, await naukriDetail(input?.url)); return true;
    }
    if (url.pathname === '/api/naukri') {
      const profile = JSON.parse((await body(req, 16384)).toString('utf8'));
      if (!profile || !['roles', 'skills'].every(key => Array.isArray(profile[key]) && profile[key].length <= 40 && profile[key].every(x => typeof x === 'string' && x.length <= 100))) { json(res, 400, { error: 'Provide roles and skills as lists of text.' }); return true; }
      json(res, 200, await naukri({ roles: profile.roles, skills: profile.skills, experienceYears: typeof profile.experienceYears === 'number' ? profile.experienceYears : null })); return true;
    }
  }
  if (req.method === 'GET') {
    if (url.pathname === '/api/jobs') {
      const token = boardToken(url.searchParams.get('board') || ''); if (!token) { json(res, 400, { error: 'Enter a Greenhouse board token or HTTPS board URL.' }); return true; }
      json(res, 200, { jobs: await fetchBoard(token), fetched: new Date().toISOString() }); return true;
    }
  }
  return false;
}
