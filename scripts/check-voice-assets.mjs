import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkVoiceAssets, sha256 } from './voice-assets.mjs';
import { voiceRegistry } from './voice-registry.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const started = performance.now();
try {
  const errors = []; let count = 0;
  for (const entry of voiceRegistry) {
    const manifest = JSON.parse(await readFile(new URL(`../${entry.manifestPath}`, import.meta.url), 'utf8'));
    count += Object.keys(manifest.clips).length;
    errors.push(...(await checkVoiceAssets(root, manifest, entry.lines, id => sha256(JSON.stringify(entry.source(id))), entry.mission)).map(error => `${entry.mission}: ${error}`));
  }
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`Voice assets: ${voiceRegistry.length} 關、${count} 台詞／設定／WAV／轉錄紀錄核對通過 (${Math.round(performance.now() - started)} ms, offline)`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
