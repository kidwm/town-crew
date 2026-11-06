import { releaseAll } from './cleanup.ts';

export type NarrationStatus = 'idle' | 'loading' | 'playing' | 'blocked' | 'unavailable' | 'muted' | 'hidden' | 'disposed';
export interface NarrationMedia extends EventTarget {
  src: string; preload: string; currentTime: number; readonly ended: boolean;
  play(): Promise<void>; pause(): void; load(): void; removeAttribute(name: string): void;
}

/** One optional media resource per connection. A replacement never queues obsolete instructions. */
export function createNarration<Id extends string>(urls: Readonly<Partial<Record<Id, string>>>, options: {
  media?: NarrationMedia; onEnded?: (id: Id) => void; onStatus?: (status: NarrationStatus) => void;
  finishCurrent?: readonly Id[];
} = {}) {
  const media = options.media ?? new Audio();
  media.preload = 'auto';
  let queue: Id[] = [], requested = '', current: Id | undefined;
  let revision = 0, pending = false, muted = false, hidden = false, disposed = false;
  let status: NarrationStatus = 'idle';
  function report(next: NarrationStatus) { status = next; options.onStatus?.(next); }
  function stop() { revision++; pending = false; current = undefined; media.pause(); }
  function start() {
    if (disposed || muted || hidden || pending || !queue.length) return;
    const id = queue[0], token = ++revision;
    current = id; pending = true;
    const url = urls[id];
    if (!url) { failed(new Error('Missing voice asset'), token); return; }
    media.src = url;
    report('loading');
    // Call play synchronously: unlock() is invoked directly in a real gesture.
    try {
      void media.play().then(() => {
        if (disposed || token !== revision) return;
        pending = false; report('playing');
      }, error => failed(error, token));
    } catch (error) { failed(error, token); }
  }
  function failed(error: unknown, token: number) {
    if (disposed || token !== revision) return;
    revision++; pending = false;
    report(error instanceof Error && error.name === 'NotAllowedError' ? 'blocked' : 'unavailable');
  }
  function ended() {
    if (disposed || !current || !media.ended) return;
    const id = current;
    revision++; pending = false; current = undefined; queue.shift();
    options.onEnded?.(id);
    report('idle'); start();
  }
  function unavailable() { if (!disposed && current) failed(new Error('Audio unavailable'), revision); }
  media.addEventListener('ended', ended);
  media.addEventListener('error', unavailable);
  return {
    status: () => status,
    setQueue(ids: readonly Id[], force = false) {
      if (disposed) return;
      const key = JSON.stringify(ids);
      if (!force && key === requested) return;
      requested = key;
      if (!force && current && ids[0] === current) { queue = [...ids]; return; }
      if (!force && current && options.finishCurrent?.includes(current) && (pending || status === 'playing')) {
        queue = [current, ...ids.filter(id => id !== current)]; return;
      }
      stop(); queue = [...ids];
      report(muted ? 'muted' : hidden ? 'hidden' : 'idle'); start();
    },
    unlock() { if (status !== 'playing' && !pending) start(); },
    playOnce(id: Id) {
      if (disposed) return;
      stop(); queue = [id]; start();
    },
    setMuted(value: boolean) {
      if (disposed || value === muted) return;
      muted = value;
      if (value) { stop(); report('muted'); } else { report(hidden ? 'hidden' : 'idle'); start(); }
    },
    setHidden(value: boolean) {
      if (disposed || value === hidden) return;
      hidden = value;
      if (value) { stop(); report('hidden'); } else { report(muted ? 'muted' : 'idle'); start(); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      revision++; pending = false; current = undefined; queue = []; requested = '';
      releaseAll([
        () => media.removeEventListener('ended', ended),
        () => media.removeEventListener('error', unavailable),
        () => media.pause(),
        () => media.removeAttribute('src'),
        () => media.load(),
        () => report('disposed'),
      ]);
    },
  };
}
