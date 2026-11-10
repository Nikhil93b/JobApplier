import { pathToFileURL } from 'node:url';
import { createAppServer } from './src/app/server.mjs';
export { createAppServer, appVersion, apiVersion } from './src/app/server.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createAppServer();
  server.listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => console.log(`Job Applier: http://localhost:${server.address().port}`));
}
