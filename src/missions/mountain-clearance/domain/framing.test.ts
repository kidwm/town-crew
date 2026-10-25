import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createMountainScene } from '../scene.ts';
import { createMountain, resumeMountain, CARRY_HEIGHT, SWEEP_START, SWEEP_END } from './mountain.ts';

test('mountain retains raised tools and whole vehicles through mirrored cleanup handoffs', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createMountainScene(h.host, h.make);
    for (const size of framingSizes) {
      h.resize(size[0], size[1]);
      for (const layout of [0, 1] as const) for (const pattern of ['spread', 'cluster'] as const) {
        const round = { layout, pattern };
        for (const phase of ['haul', 'sweep'] as const) for (let n = 0; n <= 10; n++) {
          const s = createMountain(phase, round); s[phase === 'haul' ? 'haul' : 'swept'] = n / 10;
          scene.render(s, 0); h.visible(phase === 'haul' ? 'dump-truck' : 'street-sweeper'); assert.ok(resumeMountain(s));
        }
        const digging = createMountain('excavate', round);
        for (const x of [-2.5, 3.4]) for (const z of [-5, -0.4]) { digging.bucket = { x, y: CARRY_HEIGHT, z }; scene.render(digging, 0); h.visible('excavator'); h.visible('dump-truck'); }
        for (const id of [0, 1] as const) for (const carrying of [false, true]) for (let n = 0; n <= 10; n++) {
          const s = createMountain('load-soil', round); s.loaderSelected = id; s.loaderCarrying = carrying; s.loaderTravel = n / 10;
          scene.render(s, 0); h.visible('mountain-skid-loader'); h.visible('dump-truck');
        }
      }
    }
    // Brush coverage still spans every debris row after the manual route shrinks.
    for (let i = 0; i < 24; i++) { const x = -2.8 + i % 8 * 0.8 + Math.sin(i * 3) * 0.1; assert.ok(x > SWEEP_START + 0.9 && x < SWEEP_END + 0.9); }
  })));
});
