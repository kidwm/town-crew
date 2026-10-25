import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createTrafficScene } from '../scene.ts';
import { createTraffic, towType, towDirection, driveEnd, resumeTraffic } from './traffic.ts';
import { driveWorldX, driveStateX } from './drive-view.ts';

test('both tow rigs retain the complete loaded body and inverse drag through the early handoff', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createTrafficScene(h.host, h.make);
    for (const size of framingSizes) {
      h.resize(size[0], size[1]);
      for (const pair of [['flatbed', 'wheel-lift'], ['wheel-lift', 'flatbed']] as const) for (const firstTow of [0, 1] as const) for (const selected of [0, 1] as const) {
        const s = createTraffic('tow-exit', [0, 2], [...pair], firstTow); s.selected = selected; s.action = 'ready';
        for (let n = 0; n <= 10; n++) {
          s.truckX = towDirection(s) * (8 + n * 0.3); scene.render(s, 0);
          h.visible(towType(s) === 'flatbed' ? 'flatbed-tow-truck' : 'wheel-lift-tow-truck'); h.visible(`traffic-car-${selected}`);
          assert.ok(Math.abs(driveStateX(s, driveWorldX(s)) - s.truckX) < 1e-9);
          assert.equal(resumeTraffic(s)!.truckX, s.truckX);
          const hint = scene.dragHint(s)!;
          assert.ok(Math.abs(scene.onPlane(hint.from.x, hint.from.y, 1, s)!.x - s.truckX) < 1e-8);
        }
        s.truckX = driveEnd(s); s.action = 'working'; s.elapsed = 1.5; scene.render(s, 0);
        const car = h.bounds(`traffic-car-${selected}`);
        assert.ok(car.max.x < -1 || car.min.x > 1, 'loaded car must leave before the next rig arrives');
      }
      for (const phase of ['sweeper', 'sweep', 'ambulance'] as const) {
        const s = createTraffic(phase); s.action = 'ready';
        for (const x of [s.truckX, driveEnd(s)]) { s.truckX = x; scene.render(s, 0); h.visible(phase === 'ambulance' ? 'ambulance' : 'street-sweeper'); }
      }
    }
  })));
});
