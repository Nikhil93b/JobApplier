export const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };

export async function body(req, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) { const error = new Error(limit === 10 * 1024 * 1024 ? 'File is too large. Maximum upload size is 10 MB.' : `Request is too large. Maximum size is ${limit.toLocaleString('en-US')} bytes.`); error.status = 413; throw error; } chunks.push(chunk); }
  return Buffer.concat(chunks);
}
