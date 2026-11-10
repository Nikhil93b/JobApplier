import { copyFile, mkdir } from 'node:fs/promises';
const target = new URL('./browser-helper/', import.meta.url); await mkdir(target, { recursive: true });
for (const file of ['naukri-page.mjs', 'naukri-capture.mjs']) await copyFile(new URL('./src/services/integrations/naukri/' + file, import.meta.url), new URL(file, target));
console.log('Browser helper prepared in browser-helper/. Load that folder as an unpacked extension in Chrome or Edge.');
