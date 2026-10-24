import type { TestContext } from 'node:test';
import type * as THREE from 'three';

// Real scene/session setup with small browser API fakes; no browser process required.
export class Element extends EventTarget {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  classList = { add() {} };
  innerHTML = ''; textContent = ''; value = ''; removed = false;
  children: Element[] = [];
  queries = new Map<string, Element>();
  signals: AbortSignal[] = [];
  captured = false;
  clientWidth = 1000; clientHeight = 700;
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; }
  setPointerCapture() { this.captured = true; }
  hasPointerCapture() { return this.captured; }
  releasePointerCapture() { this.captured = false; }
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  append(child: Element) { this.children.push(child); }
  remove() { this.removed = true; }
  querySelector(selector: string): Element | null {
    if (this.queries.has(selector)) return this.queries.get(selector)!;
    if (selector.startsWith('#') || selector === '.reset-stage' || selector === '.reset-tuning') return null;
    if (!this.queries.has(selector)) this.queries.set(selector, new Element());
    return this.queries.get(selector)!;
  }
  querySelectorAll() { return [] as Element[]; }
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (typeof options === 'object' && options.signal) this.signals.push(options.signal);
    super.addEventListener(type, callback, options);
  }
}

export function browser(t: TestContext) {
  const frames = new Map<number, FrameRequestCallback>();
  let started!: () => void;
  const frameReady = new Promise<void>(resolve => { started = resolve; });
  const resize = { disconnected: false, observe(_host: HTMLElement) {}, disconnect() { this.disconnected = true; } };
  let nextFrame = 0;
  const document = Object.assign(new Element(), { body: new Element(), hidden: false, createElementNS: () => new Element() });
  const window = new Element();
  const values = {
    document, window, location: { search: '' }, devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); started(); return nextFrame; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
    ResizeObserver: class {
      observe(host: HTMLElement) { resize.observe(host); }
      disconnect() { resize.disconnect(); }
    },
  };
  for (const [name, value] of Object.entries(values)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  return { document, window, frames, resize, frameReady };
}

export function renderer() {
  const calls: string[] = [];
  const canvas = new Element();
  const fake = {
    domElement: canvas, shadowMap: {},
    setPixelRatio() {}, setClearColor() {}, setSize() {},
    dispose() { calls.push('dispose'); },
    forceContextLoss() { calls.push('context-loss'); },
  };
  return { fake, calls, canvas, make: () => fake as unknown as THREE.WebGLRenderer };
}
