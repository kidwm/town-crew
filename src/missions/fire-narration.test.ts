import assert from 'node:assert/strict';
import test from 'node:test';
import { createFireNarration } from './fire-rescue/narration.ts';
import { accept, advance, createFire, grab, type FireState, type RescueId } from './fire-rescue/domain/fire.ts';
import { TestAudio } from '../../tests/helpers/lifecycle.ts';
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));
const finalFire = (phase: 'ground-fire' | 'roof-fire'): FireState => ({ ...createFire(phase), action: 'dragging',
  wet: phase === 'ground-fire' ? 2 : 3, fires: phase === 'ground-fire' ? [0, 0, 0.01, 1] : [0, 0, 0, 0.01] });

test('fire entry, phase handoff, idle help, replay and restart use only current prompts', async () => {
  const media = new TestAudio();
  let state = createFire();
  const voice = createFireNarration(state, { muted: false, hidden: false, media });
  voice.start(); await tick(); assert.match(media.src, /intro\./);
  state = { ...state, action: 'ready' }; voice.update(state); media.finish(); await tick();
  assert.match(media.src, /dispatch\./);
  voice.update(state); media.finish();
  voice.update(state, 12); await tick(); assert.match(media.src, /dispatch-help\./);
  voice.update(state, 0.1); assert.match(media.src, /dispatch-help\./);
  media.finish(); const count = media.plays.length; voice.update(state, 20); assert.equal(media.plays.length, count);
  voice.update(createFire('hose')); await tick(); assert.match(media.src, /hose\./);
  voice.replay(); await tick(); assert.match(media.src, /hose\./);
  voice.restart(createFire()); await tick(); assert.match(media.src, /intro\./);
  voice.dispose(); assert.equal(media.src, '');
});

test('resumed progress skips intro and committed rescue does not repeat choice guidance', async () => {
  const media = new TestAudio(), state = { ...createFire('rescue'), rescued: [true, false] };
  const voice = createFireNarration(state, { muted: false, hidden: false, media });
  voice.start(); await tick(); assert.match(media.src, /rescue-cat\./);
  voice.update({ ...state, action: 'working', passenger: 'cat' });
  const count = media.plays.length; voice.replay(); assert.equal(media.plays.length, count);
  voice.dispose();
});

test('short automatic animations do not cut announcements, while the next prompt stays current', async () => {
  const media = new TestAudio();
  const voice = createFireNarration(createFire('stowing'), { muted: false, hidden: false, media });
  voice.start(); await tick(); assert.match(media.src, /stowing\./);
  voice.update(createFire('ambulance')); assert.match(media.src, /stowing\./);
  voice.update({ ...createFire('ambulance'), action: 'ready' });
  voice.update(createFire('stretcher'));
  media.finish(); await tick(); assert.match(media.src, /stretcher\./);
  assert.equal(media.plays.some(url => /ambulance\./.test(url)), false);
  voice.restart(createFire('departure')); await tick();
  voice.update(createFire('complete')); assert.match(media.src, /departure\./);
  media.finish(); await tick(); assert.match(media.src, /complete\./);
  voice.dispose();
});

for (const phase of ['ground-fire', 'roof-fire'] as const) test(`${phase}: one success clip precedes the latest next-step prompt`, async () => {
  const media = new TestAudio(); let state = finalFire(phase);
  const voice = createFireNarration(state, { muted: false, hidden: false, media }); voice.start(); await tick();
  state = advance(state, 0.1); voice.update(state); await tick();
  assert.match(media.src, /fire-out\./);
  for (let i = 0; i < 30; i++) { state = advance(state, 0.1); voice.update(state); voice.update(state); }
  assert.equal(media.plays.filter(url => /fire-out\./.test(url)).length, 1);
  assert.match(media.src, /fire-out\./, 'short animations cannot interrupt the feedback');
  media.finish(); await tick();
  assert.match(media.src, phase === 'ground-fire' ? /roof-reach\./ : /rescue-choice\./);
  voice.update(state); media.finish(); voice.update(state);
  assert.equal(media.plays.filter(url => /fire-out\./.test(url)).length, 1);
  voice.dispose();
});

for (const order of [['resident', 'cat'], ['cat', 'resident']] as RescueId[][]) test(`pickup feedback waits for boarding in ${order.join(' then ')} order`, async () => {
  const media = new TestAudio(); let state = createFire('rescue');
  const voice = createFireNarration(state, { muted: false, hidden: false, media }); voice.start(); await tick(); media.finish();
  for (const [index, passenger] of order.entries()) {
    state = grab(state); voice.update(state);
    state = accept(state, passenger); voice.update(state);
    assert.equal(media.plays.filter(url => /picked-up\./.test(url)).length, index, 'reaching the target is too early');
    while (state.action === 'working') { state = advance(state, 0.1); voice.update(state); }
    await tick(); assert.match(media.src, /picked-up\./);
    while (state.action === 'returning' || state.action === 'unloading') { state = advance(state, 0.1); voice.update(state); }
    voice.update(state); assert.equal(media.plays.filter(url => /picked-up\./.test(url)).length, index + 1);
    media.finish(); await tick();
    assert.match(media.src, index === 0 ? (passenger === 'resident' ? /rescue-cat\./ : /rescue-resident\./) : /stowing\./);
    media.finish();
  }
  voice.dispose();
});

test('new input and restart discard pending success; restored snapshots do not invent events', async () => {
  const media = new TestAudio(); let state = finalFire('roof-fire');
  const voice = createFireNarration(state, { muted: false, hidden: false, media }); voice.start();
  state = advance(state, 0.1); voice.update(state); await tick();
  while (state.action === 'returning') { state = advance(state, 0.1); voice.update(state); }
  voice.update(grab(state)); await tick(); assert.match(media.src, /rescue-choice\./, 'a new action interrupts outdated feedback');
  voice.restart(finalFire('roof-fire')); voice.update(advance(finalFire('roof-fire'), 0.1)); await tick();
  voice.restart(createFire()); assert.match(media.src, /intro\./); voice.dispose();
  for (const initial of [advance(finalFire('roof-fire'), 0.1), { ...createFire('rescue'), action: 'returning' as const, passenger: 'cat' as const }]) {
    const resumedMedia = new TestAudio(), resumed = createFireNarration(initial, { muted: false, hidden: false, media: resumedMedia });
    resumed.start(); resumed.update(advance(initial, 0.1)); resumed.replay();
    assert.equal(resumedMedia.plays.length, 0); resumed.dispose();
  }
});

for (const setting of ['setMuted', 'setHidden'] as const) test(`${setting}: success is discarded and never accumulates in the background`, async () => {
  const media = new TestAudio(); let state = finalFire('roof-fire');
  const voice = createFireNarration(state, { muted: false, hidden: false, media }); voice.start();
  state = advance(state, 0.1); voice.update(state); await tick(); assert.match(media.src, /fire-out\./);
  voice[setting](true);
  while (state.action === 'returning') { state = advance(state, 0.1); voice.update(state); }
  voice[setting](false); await tick(); assert.match(media.src, /rescue-choice\./);
  assert.equal(media.plays.filter(url => /fire-out\./.test(url)).length, 1);
  voice[setting](true); voice.restart(finalFire('roof-fire'));
  voice.update(advance(finalFire('roof-fire'), 0.1)); voice[setting](false);
  assert.equal(media.plays.filter(url => /fire-out\./.test(url)).length, 1);
  voice.dispose();
});
