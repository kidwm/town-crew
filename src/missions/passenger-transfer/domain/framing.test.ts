import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createTransferScene } from '../scene.ts';
import { createTransit, currentVehicle } from './transit.ts';

test('transfer frame keeps both waiting choices and full open doors in either visiting order', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createTransferScene(h.host, h.make);
    for (const size of framingSizes) {
      h.resize(size[0], size[1]);
      for (const layout of [0, 1] as const) for (const companion of ['school', 'coach'] as const) {
        const round = { layout, palette: 0, cast: 0, companion };
        scene.render(createTransit('choose', round), 0); h.visible('transfer-taxi'); h.visible(`transfer-${companion}`);
        for (const phase of ['bus-door', 'transfer-door', 'coach-door'] as const) {
          const s = createTransit(phase, round), vehicle = currentVehicle(s); s.doors[vehicle] = 1;
          scene.render(s, 0); h.visible(`transfer-${vehicle}`);
        }
      }
    }
  })));
});
