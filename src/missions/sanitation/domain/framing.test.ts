import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createSanitationScene } from '../scene.ts';
import { createSanitation } from './sanitation.ts';

test('sanitation frame includes real bin lids and lift extremes in either layout and service order', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createSanitationScene(h.host, h.make);
    for (const size of framingSizes) {
      h.resize(size[0], size[1]);
      for (const layout of [0, 1] as const) for (const service of ['food-first', 'recycle-first'] as const) {
        for (const phase of ['bin-lift', 'food-lift', 'bin-tip', 'food-tip'] as const) for (let n = 0; n <= 10; n++) {
          const s = createSanitation(phase, { layout, palette: 0, cast: 0, service }); s.travel = n / 10; s.elapsed = n * 0.36;
          scene.render(s, 0); h.visible(phase.startsWith('bin') ? 'garbage-truck' : 'food-waste-truck');
          h.visible(phase.startsWith('bin') ? 'wheelie-bin' : 'food-bin');
        }
      }
    }
  })));
});
