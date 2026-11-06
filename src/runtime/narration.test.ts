import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { createNarration } from './narration.ts';
import { TestAudio } from '../../tests/helpers/lifecycle.ts';
const urls = { intro: '/intro.wav', hint: '/hint.wav', next: '/next.wav' };
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));

test('cleanup still removes media source and listeners when pause fails', t => {
  const media = new TestAudio(), voice = createNarration(urls, { media });
  voice.setQueue(['intro']);
  t.mock.method(media, 'pause', () => { throw new Error('pause failed'); });
  assert.throws(() => voice.dispose(), AggregateError);
  assert.equal(media.src, ''); assert.equal(media.loads, 1);
  assert.equal(getEventListeners(media, 'ended').length, 0);
  assert.equal(getEventListeners(media, 'error').length, 0);
  assert.equal(voice.status(), 'disposed');
});

test('blocked autoplay retries synchronously on a gesture and serializes intro/hint', async t => {
  const media = new TestAudio();
  const original = media.play.bind(media);
  const play = t.mock.method(media, 'play', () => Promise.reject(new DOMException('gesture required', 'NotAllowedError')));
  const voice = createNarration(urls, { media });
  voice.setQueue(['intro', 'hint']); await tick();
  assert.equal(voice.status(), 'blocked');
  play.mock.restore(); t.mock.method(media, 'play', original);
  voice.unlock(); assert.deepEqual(media.plays, ['/intro.wav']); await tick();
  media.finish(); assert.deepEqual(media.plays, ['/intro.wav', '/hint.wav']); await tick();
  media.finish(); voice.setQueue(['intro', 'hint']);
  assert.equal(media.plays.length, 2, 'unchanged state does not loop speech');
  voice.dispose(); assert.equal(media.src, ''); assert.equal(media.loads, 1);
});

test('late play results and end events cannot restart disposed or replaced speech', async t => {
  const media = new TestAudio(); let resolve!: () => void;
  t.mock.method(media, 'play', () => new Promise<void>(done => { resolve = done; }));
  const voice = createNarration(urls, { media });
  voice.setQueue(['intro']); const first = resolve;
  voice.setQueue(['next']); first(); await tick();
  assert.equal(voice.status(), 'loading');
  voice.dispose(); resolve(); media.finish(); await tick();
  assert.equal(voice.status(), 'disposed'); assert.equal(media.src, '');
});

test('mute and hidden suppress speech while retaining only the current instruction', async () => {
  const media = new TestAudio(), voice = createNarration(urls, { media });
  voice.setQueue(['intro', 'hint']); await tick();
  voice.setMuted(true); voice.setQueue(['next']); voice.unlock();
  assert.deepEqual(media.plays, ['/intro.wav']);
  voice.setHidden(true); voice.setMuted(false);
  assert.equal(media.plays.length, 1);
  voice.setHidden(false); await tick();
  assert.deepEqual(media.plays, ['/intro.wav', '/next.wav']);
  voice.dispose();
});

test('optional load failure does not reject and a replay can recover', async t => {
  const media = new TestAudio(), voice = createNarration(urls, { media });
  const play = t.mock.method(media, 'play', () => { throw new Error('decoder failed'); });
  voice.setQueue(['hint']); assert.equal(voice.status(), 'unavailable');
  play.mock.restore(); voice.setQueue(['hint'], true); await tick();
  assert.equal(voice.status(), 'playing');
  voice.dispose();
});

test('an idle reminder is not replaced by the unchanged per-frame instruction', async () => {
  const media = new TestAudio(), voice = createNarration(urls, { media });
  voice.setQueue(['hint']); await tick(); media.finish();
  voice.playOnce('next'); voice.setQueue(['hint']); await tick();
  assert.deepEqual(media.plays, ['/hint.wav', '/next.wav']);
  media.finish(); voice.setQueue(['hint']); assert.equal(media.plays.length, 2);
  voice.dispose();
});
