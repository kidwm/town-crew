// Explicit local authoring only. API keys and candidate audio never enter the app.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sha256, spokenWords, checkVoiceAssets } from './voice-assets.mjs';
import { voiceRegistry } from './voice-registry.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
try { process.loadEnvFile(resolve(root, '.env.local')); } catch {}
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('Set GEMINI_API_KEY in .env.local');
const safe = message => [key, process.env.OPENAI_API_KEY].filter(Boolean).reduce((s, secret) => s.replaceAll(secret, '[redacted]'), String(message));
const reviewProvider = process.env.VOICE_REVIEW_PROVIDER ?? 'gemini';
if (!['gemini', 'openai'].includes(reviewProvider)) throw new Error('Unknown VOICE_REVIEW_PROVIDER');
if (reviewProvider === 'openai' && !process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY for OpenAI transcription');
const [mission = 'all', ...args] = process.argv.slice(2);
const regenerate = args.includes('--regenerate'), ids = args.filter(id => id !== '--regenerate');
const entries = voiceRegistry.filter(e => mission === 'all' || e.mission === mission);
if (!entries.length || mission === 'all' && ids.length) throw new Error('Usage: voice:generate -- <mission|all> [ids] [--regenerate]');
if (ids.some(id => !(id in entries[0].lines))) throw new Error('Unknown voice ID');
const speechHash = source => { const { cues, ...speech } = source; return sha256(JSON.stringify(speech)); };
const cacheRoot = resolve(root, 'output/voice-candidates');
await mkdir(cacheRoot, { recursive: true });
let lastTts = 0, failures = 0;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function request(body) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key, 'Api-Revision': '2026-05-20' },
      body: JSON.stringify({ ...body, store: false }), signal: AbortSignal.timeout(90000),
    });
    const data = await response.json();
    if (response.status === 429 && attempt < 2) {
      const delay = Number(data.error?.message?.match(/retry in (\d+)s\b/i)?.[1]);
      if (Number.isFinite(delay) && delay <= 55) { console.log(`Quota: waiting ${delay + 1}s`); await wait((delay + 1) * 1000); continue; }
    }
    if (!response.ok) {
      const message = safe(data.error?.message ?? response.statusText);
      const error = new Error(`HTTP ${response.status}: ${message}`);
      error.dailyQuota = response.status === 429 && /requests per day|daily|per.day/i.test(message);
      throw error;
    }
    if (data.status !== 'completed') throw new Error(`Incomplete response: ${data.status}`);
    return data;
  }
}
const output = response => response.steps.filter(step => step.type === 'model_output').flatMap(step => step.content ?? []);
const reviewPrompt = '這是一段幼兒城市遊戲的旁白。將音檔實際聽到的全部語音以繁體中文逐字轉錄，保留語助詞，不要猜測、改寫、加前言或說明。只回傳逐字稿。';
async function transcribe(bytes) {
  // Accepts audio only: never the expected line, cue, ID, or pronunciation hints.
  if (reviewProvider === 'openai') {
    const model = process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-transcribe';
    const body = new FormData();
    body.append('model', model); body.append('file', new Blob([bytes], { type: 'audio/wav' }), 'audio.wav'); body.append('prompt', reviewPrompt);
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body, signal: AbortSignal.timeout(90000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${safe(data.error?.message ?? response.statusText)}`);
    return { ...data, model, prompt: reviewPrompt, transcript: data.text?.trim() ?? '' };
  }
  const data = await request({ model: process.env.GEMINI_TRANSCRIPTION_MODEL ?? 'gemini-3.1-flash-lite', input: [
    { type: 'text', text: reviewPrompt }, { type: 'audio', mime_type: 'audio/wav', data: bytes.toString('base64') },
  ] });
  return { ...data, prompt: reviewPrompt, transcript: output(data).filter(p => p.type === 'text').map(p => p.text).join('').trim() };
}
// Reuse only identical speech settings/text and verified bytes. Cue bindings are
// recorded separately for each mission; reuse never pretends another ASR call ran.
const reusable = new Map();
for (const entry of voiceRegistry) {
  let manifest; try { manifest = JSON.parse(await readFile(resolve(root, entry.manifestPath), 'utf8')); } catch { continue; }
  for (const [id, clip] of Object.entries(manifest.clips)) {
    if (!(id in entry.lines)) continue;
    const source = entry.source(id);
    if (clip.textHash !== sha256(source.text) || clip.sourceHash !== sha256(JSON.stringify(source)) || clip.review?.audioHash !== clip.audioHash
      || clip.review?.method !== 'independent-asr' || !clip.review?.model || !clip.review?.reviewedAt
      || clip.review?.sourceHash !== clip.sourceHash || clip.review?.referenceTextSupplied !== false
      || spokenWords(clip.review?.transcript ?? '') !== spokenWords(source.text)) continue;
    try {
      const bytes = await readFile(resolve(root, 'public', clip.file));
      if (sha256(bytes) === clip.audioHash) reusable.set(speechHash(source), { bytes, generated: clip.generation, review: clip.review, from: `${entry.mission}/${id}` });
    } catch {}
  }
}
batch: for (const entry of entries) {
  let manifest; try { manifest = JSON.parse(await readFile(resolve(root, entry.manifestPath), 'utf8')); } catch { manifest = { version: 1, clips: {} }; }
  const errors = await checkVoiceAssets(root, manifest, entry.lines, id => sha256(JSON.stringify(entry.source(id))), entry.mission);
  const chosen = ids.length ? ids : Object.keys(entry.lines).filter(id => regenerate || !manifest.clips[id] || errors.some(error => error.startsWith(`${id}:`)));
  await mkdir(resolve(root, `public/voice/${entry.mission}`), { recursive: true });
  await mkdir(resolve(cacheRoot, entry.mission), { recursive: true });
  for (const id of chosen) {
    const label = `${entry.mission}/${id}`;
    try {
      const source = entry.source(id), sourceHash = sha256(JSON.stringify(source)), speech = speechHash(source);
      const candidate = resolve(cacheRoot, entry.mission, id);
      let bytes, generated, review;
      const shared = !regenerate && reusable.get(speech);
      if (shared) {
        ({ bytes, generated } = shared);
        // Explicit IDs request a fresh independent review, including an explicit
        // provider change. Reuse the recording, not its old review, in that case.
        if (!ids.length) review = { ...shared.review, reusedFrom: shared.from, sourceHash };
        console.log(`${label}: reusing identical audio from ${shared.from}${ids.length ? '; fresh review requested' : ' with verified transcript'}`);
      }
      if (!bytes && !regenerate) {
        for (const path of [candidate, ...(entry.mission === 'fire-rescue' ? [resolve(cacheRoot, id)] : [])]) {
          try {
            const prior = JSON.parse(await readFile(`${path}.json`, 'utf8')), wav = await readFile(`${path}.wav`);
            if ((prior.speechHash === speech || prior.sourceHash === sourceHash) && prior.audioHash === sha256(wav)) { generated = prior; bytes = wav; break; }
          } catch {}
        }
      }
      if (!bytes) {
        const spacing = 21000 - (Date.now() - lastTts); if (spacing > 0) await wait(spacing);
        console.log(`${label}: generating ${source.model} / ${source.voice}`); lastTts = Date.now();
        const result = await request({ model: source.model,
          input: [{ type: 'user_input', content: [{ type: 'text', text: source.text, annotations: [{ type: 'speech_metadata', style: [source.instructions, source.pronunciation].filter(Boolean).join('\n') }] }] }],
          response_format: { type: 'audio', mime_type: 'audio/wav' }, generation_config: { speech_config: [{ voice: source.voice }] },
        });
        const blocks = output(result).filter(p => p.type === 'audio' && p.data);
        if (blocks.length !== 1) throw new Error('Expected one audio block');
        bytes = Buffer.from(blocks[0].data, 'base64');
        if (bytes.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Expected WAV audio');
        generated = { sourceHash, speechHash: speech, audioHash: sha256(bytes), model: result.model, voice: source.voice, generatedAt: new Date().toISOString(), usage: result.usage };
        await writeFile(`${candidate}.wav`, bytes); await writeFile(`${candidate}.json`, JSON.stringify(generated, null, 2) + '\n');
      }
      if (!review) {
        for (let attempt = 0; attempt < 2; attempt++) {
          console.log(`${label}: independent transcription ${attempt + 1}/2 (no reference text)`);
          const verification = await transcribe(bytes);
          await writeFile(`${candidate}-review-${Date.now()}.json`, JSON.stringify(verification, null, 2) + '\n');
          if (spokenWords(verification.transcript) === spokenWords(source.text)) {
            review = { method: 'independent-asr', model: verification.model, prompt: verification.prompt, referenceTextSupplied: false,
              transcript: verification.transcript, sourceHash, audioHash: sha256(bytes), reviewedAt: new Date().toISOString(), usage: verification.usage };
            break;
          }
          console.log(`${label}: transcript differs: ${verification.transcript}`);
        }
        if (!review) throw new Error('Transcription differs; candidate retained, manifest not approved.');
      }
      const audioHash = sha256(bytes), file = `voice/${entry.mission}/${id}.${audioHash.slice(0, 12)}.wav`;
      await writeFile(resolve(root, 'public', file), bytes);
      manifest.clips[id] = { file, textHash: sha256(source.text), sourceHash, audioHash, generation: generated, review };
      await writeFile(resolve(root, entry.manifestPath), JSON.stringify(manifest, null, 2) + '\n');
      reusable.set(speech, { bytes, generated, review, from: label });
      console.log(`${label}: saved and verified`);
    } catch (error) {
      console.error(`${label}: ${safe(error.message)}`); failures++;
      if (error.dailyQuota) { console.error('Daily quota exhausted: batch stopped. Rerun after quota is available.'); break batch; }
    }
  }
}
if (failures) { console.error(`${failures} clips still require review; successful clips retained.`); process.exitCode = 1; }
