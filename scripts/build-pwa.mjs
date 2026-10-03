import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const output = new URL('../dist/', import.meta.url);
const worker = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
const files = (await readdir(output, { recursive: true, withFileTypes: true }))
  .filter(file => file.isFile() && file.name !== 'sw.js' && file.name !== '_headers')
  .map(file => relative(fileURLToPath(output), join(file.parentPath, file.name)).replaceAll('\\', '/'))
  .sort();
// Hash both content and worker logic, including non-hashed public assets.
const revision = createHash('sha256').update(worker);
for (const file of files) {
  revision.update(file).update(await readFile(new URL(file, output)));
}
const config = `const CACHE_PREFIX = 'town-crew:precache:';\nconst CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(revision.digest('hex').slice(0, 16))};\nconst PRECACHE_PATHS = ${JSON.stringify(files, null, 2)};\n\n`;
await writeFile(new URL('sw.js', output), config + worker);
console.log(`PWA: precached ${files.length} files, including all mission chunks.`);
