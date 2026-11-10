import { mkdir, writeFile } from 'node:fs/promises';

export async function recordSearchDiagnostic(data) {
  try {
    const directory = new URL('../../../.local/', import.meta.url); await mkdir(directory, { recursive: true });
    await writeFile(new URL('last-search-diagnostic.json', directory), JSON.stringify({ ...data, recordedAt: new Date().toISOString() }, null, 2));
  } catch { /* Diagnostic storage must not turn a successful search into a failure. */ }
}
