import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createHouseScene } from '../scene.ts';
import { createHouse, HOUSE, LOAD_HOME, DELIVERY_START, DELIVERY_STOP } from './house.ts';
import { DEFAULT_ROUND, ROOF_TYPES } from './round.ts';

test('house frame retains mirrored delivery, all roof lifts, empty hook and completed home', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createHouseScene(h.host, h.make);
    for (const size of framingSizes) {
      h.resize(size[0], size[1]);
      for (const layout of [0, 1] as const) for (const roof of ROOF_TYPES) {
        const round = { ...DEFAULT_ROUND, layout, roof };
        const delivery = createHouse('delivery-one', round); delivery.action = 'ready';
        for (const x of [DELIVERY_START, DELIVERY_STOP]) { delivery.truckX = x; scene.render(delivery, 0); h.visible('flatbed-transporter'); }
        for (let placed = 0; placed < 6; placed++) {
          const s = createHouse(placed < 3 ? 'crane-one' : 'crane-two', round); s.placed = placed;
          scene.render(s, 0); h.visible('mobile-crane');
          s.attached = true;
          for (const load of [LOAD_HOME, HOUSE, { x: -4.5, z: -2.5 }, { x: 4.8, z: -2.5 }]) {
            s.load = { ...load }; scene.render(s, 0); h.visible('mobile-crane'); h.visible(`house-part-${placed}`);
          }
        }
        scene.render(createHouse('complete', round), 0); h.visible('house-part-5'); h.visible('house-garage'); h.visible('house-family-car');
      }
    }
  })));
});
