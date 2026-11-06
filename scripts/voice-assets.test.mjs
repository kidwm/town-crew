import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkVoiceAssets, sha256 } from './voice-assets.mjs';

for (const mission of ['fire-rescue']) test(`${mission}: offline CI rejects stale text, settings, bytes, missing clips and stale ASR evidence`, async t => {
  const root = await mkdtemp(join(tmpdir(), 'fire-voice-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, `public/voice/${mission}`), { recursive: true });
  const bytes = Buffer.alloc(1024); bytes.write('RIFF'); bytes.write('WAVE', 8);
  const audioHash = sha256(bytes), sourceHash = sha256('source');
  const file = `voice/${mission}/hint.${audioHash.slice(0, 12)}.wav`;
  await writeFile(join(root, 'public', file), bytes);
  const lines = { hint: '接大家下來。' };
  const clip = { file, audioHash, sourceHash, textHash: sha256(lines.hint), review: {
    method: 'independent-asr', model: 'test-asr', reviewedAt: '2026-11-05', referenceTextSupplied: false,
    audioHash, sourceHash, transcript: '接大家下來！',
  } };
  const manifest = { version: 1, clips: { hint: clip } };
  const check = (value = manifest, text = lines, source = sourceHash) => checkVoiceAssets(root, value, text, () => source, mission);
  assert.deepEqual(await check(), []);
  assert.match((await check({ version: 1, clips: { hint: { ...clip, file: 'voice/another-mission/hint.wav' } } })).join(), /invalid audio path/);
  assert.match((await check({ version: 1, clips: { hint: { ...clip, review: { ...clip.review, referenceTextSupplied: true } } } })).join(), /轉錄核對/);
  assert.match((await check(manifest, { hint: '接小貓下來。' })).join(), /台詞已變更/);
  assert.match((await check(manifest, lines, 'changed-voice')).join(), /配音設定/);
  assert.match((await check({ version: 1, clips: {} })).join(), /Missing/);
  assert.match((await check({ version: 1, clips: { hint: { ...clip, review: { ...clip.review, audioHash: 'old' } } } })).join(), /轉錄核對/);
  const corrupted = Buffer.from(bytes); corrupted[100] = 1;
  await writeFile(join(root, 'public', file), corrupted);
  assert.match((await check()).join(), /音檔雜湊/);
  await rm(join(root, 'public', file));
  assert.match((await check()).join(), /找不到音檔/);
});
