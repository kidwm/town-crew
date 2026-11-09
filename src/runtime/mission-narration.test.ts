import assert from 'node:assert/strict';
import test from 'node:test';
import { createMissionNarration } from './mission-narration.ts';
import type { VoicePlan } from './voice-script.ts';
import { TestAudio } from '../../tests/helpers/lifecycle.ts';

type State = { phase: 'intro' | 'move' | 'auto' | 'next' | 'complete'; dragging?: boolean; count?: number };
const lines = { intro: '一起幫忙。', move: '拖到光圈。', next: '往上拉。', success: '放好了！', complete: '完成了！' };
const plan: VoicePlan<State, keyof typeof lines> = {
  mission: 'test', lines, cues: { intro: [], move: ['move'], auto: [], next: ['next'], complete: ['complete'] }, events: { introduction: 'intro', placed: 'success' },
  initial: s => s.phase === 'intro', interacting: s => !!s.dragging,
  instruction: s => s.phase === 'move' || s.phase === 'next' || s.phase === 'complete' ? s.phase : undefined,
  feedback: (a, b) => (b.count ?? 0) > (a.count ?? 0) ? 'success' : undefined,
};
const urls = Object.fromEntries(Object.keys(lines).map(id => [id, `/${id}.wav`]));
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));
const make = (state: State, options = {}) => {
  const media = new TestAudio();
  return { media, voice: createMissionNarration(plan, state, urls, { muted: false, hidden: false, media, ...options }) };
};

test('intro survives automatic handoff, then plays only the latest instruction', async () => {
  const { voice, media } = make({ phase: 'intro' }); voice.start(); await tick();
  voice.update({ phase: 'move' }); voice.update({ phase: 'next' });
  assert.equal(media.src, '/intro.wav'); media.finish(); await tick();
  assert.equal(media.src, '/next.wav');
  for (let i = 0; i < 30; i++) voice.update({ phase: 'next' });
  assert.deepEqual(media.plays, ['/intro.wav', '/next.wav']);
  media.finish(); voice.update({ phase: 'next' }); assert.equal(media.plays.length, 2);
  voice.replay(); assert.equal(media.plays.at(-1), '/next.wav'); voice.dispose();
});

test('a fresh action interrupts intro and old feedback; repeated frames never re-announce success', async () => {
  const { voice, media } = make({ phase: 'intro' }); voice.start(); await tick();
  voice.update({ phase: 'move', dragging: true }); assert.equal(media.src, '/move.wav');
  voice.update({ phase: 'auto', count: 1 }); await tick(); assert.equal(media.src, '/success.wav');
  for (let i = 0; i < 30; i++) voice.update({ phase: 'auto', count: 1 });
  voice.update({ phase: 'next', count: 1 }); assert.equal(media.src, '/success.wav');
  voice.update({ phase: 'next', count: 1, dragging: true }); assert.equal(media.src, '/next.wav');
  assert.equal(media.plays.filter(url => url === '/success.wav').length, 1); voice.dispose();
});

for (const pause of ['setMuted', 'setHidden'] as const) test(`${pause} discards success and resumes the current instruction`, async () => {
  const { voice, media } = make({ phase: 'move' }); voice.start(); await tick();
  voice.update({ phase: 'auto', count: 1 }); voice[pause](true);
  voice.update({ phase: 'next', count: 2 }); const count = media.plays.length;
  voice[pause](false); await tick(); assert.equal(media.src, '/next.wav');
  assert.deepEqual(media.plays.slice(count), ['/next.wav']); voice.dispose();
});

test('restore skips introduction and successes; reset does not synthesize progress events', async () => {
  const { voice, media } = make({ phase: 'intro' }, { restored: true }); voice.start();
  assert.equal(media.plays.length, 0);
  voice.update({ phase: 'move' }); await tick();
  voice.restart({ phase: 'next', count: 4 }); assert.equal(media.src, '/next.wav');
  voice.restart({ phase: 'intro' }); assert.equal(media.src, '/intro.wav');
  assert.equal(media.plays.includes('/success.wav'), false); voice.dispose();
});

test('cancel and unchanged partial progress do not create success feedback', () => {
  const { voice, media } = make({ phase: 'move', count: 0 }); voice.start();
  voice.update({ phase: 'move', dragging: true, count: 0 });
  voice.update({ phase: 'move', count: 0 });
  assert.equal(media.plays.includes('/success.wav'), false); voice.dispose();
});

test('missing recordings are optional at runtime and cannot obscure the current instruction', () => {
  const media = new TestAudio(); const statuses: string[] = [];
  const voice = createMissionNarration(plan, { phase: 'intro' }, {}, { muted: false, hidden: false, media, onStatus: s => statuses.push(s) });
  voice.start(); voice.update({ phase: 'move' });
  assert.equal(voice.text(), lines.move); assert.equal(statuses.at(-1), 'unavailable');
  voice.update({ phase: 'next', count: 1 }); assert.equal(voice.text(), lines.next);
  voice.replay(); assert.deepEqual(media.plays, []); assert.equal(media.src, ''); voice.dispose();
});

test('late play rejection and ended after disposal cannot revive the controller', async () => {
  const { voice, media } = make({ phase: 'move' });
  let reject!: (error: Error) => void;
  media.play = () => new Promise((_, no) => { reject = no; });
  voice.start(); voice.dispose(); reject(new Error('late')); media.finish(); await tick();
  voice.update({ phase: 'next', count: 1 }); voice.replay();
  assert.equal(media.src, ''); assert.equal(media.loads, 1);
});
