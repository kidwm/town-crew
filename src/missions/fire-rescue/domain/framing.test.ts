import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createFireScene } from '../scene.ts';
import { driveWorldX, driveStateX } from '../drive-view.ts';
import { createFire, DRIVE_START, ENGINE_STOP, STREET_STOP, RESCUES, ROOF_DOCK, resumeFire } from './fire.ts';

test('fire approach stays visible and inverse input preserves saved partial progress', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createFireScene(h.host, h.make);
    for (const size of framingSizes) {
      h.resize(size[0], size[1]);
      for (const phase of ['dispatch', 'ambulance'] as const) for (const amount of [0, 0.25, 0.5, 1]) {
        const s = createFire(phase); s.action = 'ready'; s.truckX = DRIVE_START + ((phase === 'dispatch' ? ENGINE_STOP : STREET_STOP) - DRIVE_START) * amount;
        scene.render(s, 0); h.visible(phase === 'dispatch' ? 'fire-engine' : 'ambulance');
        assert.ok(Math.abs(driveStateX(s, driveWorldX(s)) - s.truckX) < 1e-9);
        assert.equal(resumeFire(s)!.truckX, s.truckX);
        const hint = scene.dragHint(s)!;
        const point = scene.onPlane(hint.from.x, hint.from.y, false, 1.5, s)!;
        assert.ok(Math.abs(point.x - s.truckX) < 1e-8);
      }
      const s = createFire('rescue');
      for (const basket of [s.basket, ROOF_DOCK, ...RESCUES.map(r => r.dock)]) { s.basket = { ...basket }; scene.render(s, 0); h.visible('aerial-fire-truck'); h.visible('fire-engine'); }
      scene.render(createFire('boarding'), 0); h.visible('ambulance'); h.visible('ambulance-stretcher');
    }
  })));
});
