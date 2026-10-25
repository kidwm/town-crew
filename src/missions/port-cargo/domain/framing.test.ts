import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createPortScene } from '../scene.ts';
import { createPort, resumePort } from './port.ts';

test('port keeps the whole hull, transporter and crane inside both mirrored manual routes', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createPortScene(h.host, h.make);
    for (const size of framingSizes) {
      h.resize(size[0], size[1]);
      for (const layout of [0, 1] as const) for (const direction of ['load', 'unload'] as const) {
        const round = { layout, direction, palette: 0 };
        for (const phase of ['boat', 'truck', direction === 'load' ? 'ship-transport' : 'transport'] as const) {
          const s = createPort(phase, round);
          for (let n = 0; n <= 10; n++) {
            const value = n / 10; if (phase === 'boat') s.boat = value; else if (phase === 'truck') s.truck = value; else s.haul = value;
            scene.render(s, 0); h.visible('port-cargo-boat');
            if (phase !== 'ship-transport') h.visible('flatbed-transporter');
            assert.ok(resumePort(s));
          }
        }
        const s = createPort(direction === 'load' ? 'load-ship' : 'unload', round);
        s.selected = 0; s.craneAttached = true; s.lift = 1;
        for (const load of [{ x: -1.8, z: -5.8 }, { x: 4.3, z: -1.35 }]) { s.load = load; scene.render(s, 0); h.visible('mobile-crane'); h.visible('port-pallet-0'); }
      }
    }
  })));
});
