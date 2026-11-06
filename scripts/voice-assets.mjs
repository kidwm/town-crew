import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fireLines, fireVoiceSource } from '../src/missions/fire-rescue/domain/narration.ts';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const spokenWords = value => value.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');
export const voiceSourceHash = id => sha256(JSON.stringify(fireVoiceSource(id)));
export const manifestPath = 'src/missions/fire-rescue/voice-assets.json';

export async function checkVoiceAssets(root, manifest, lines = fireLines, sourceHash = voiceSourceHash, mission = 'fire-rescue') {
  const errors = [];
  if (manifest.version !== 1) errors.push('Unsupported voice manifest version');
  const ids = Object.keys(lines).sort();
  const actual = Object.keys(manifest.clips ?? {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify(ids)) errors.push(`Missing or unexpected voice IDs (missing: ${ids.filter(id => !actual.includes(id)).join(', ') || 'none'}; unexpected: ${actual.filter(id => !ids.includes(id)).join(', ') || 'none'})`);
  for (const id of ids) {
    const clip = manifest.clips?.[id];
    if (!clip) continue;
    if (clip.textHash !== sha256(lines[id])) errors.push(`${id}: 台詞已變更，請重錄並核對`);
    if (clip.sourceHash !== sourceHash(id)) errors.push(`${id}: 配音設定或提示對應已變更，請重新核對`);
    const directory = resolve(root, `public/voice/${mission}`) + sep;
    const file = resolve(root, 'public', clip.file ?? '');
    if (!file.startsWith(directory) || !file.endsWith('.wav')) { errors.push(`${id}: invalid audio path`); continue; }
    try {
      const bytes = await readFile(file);
      if (bytes.length < 1000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') errors.push(`${id}: invalid WAV`);
      if (sha256(bytes) !== clip.audioHash) errors.push(`${id}: 音檔雜湊不符`);
      if (!clip.file.endsWith(`.${clip.audioHash.slice(0, 12)}.wav`)) errors.push(`${id}: filename hash is stale`);
    } catch { errors.push(`${id}: 找不到音檔`); }
    const review = clip.review;
    if (!review || review.method !== 'independent-asr' || review.referenceTextSupplied !== false || !review.model || !review.reviewedAt
      || review.audioHash !== clip.audioHash || review.sourceHash !== clip.sourceHash
      || spokenWords(review.transcript ?? '') !== spokenWords(lines[id])) errors.push(`${id}: 缺少與目前台詞、設定及音檔綁定的轉錄核對`);
  }
  return errors;
}
