import test from 'node:test';
import assert from 'node:assert/strict';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createRailScene } from '../scene.ts';
import { available, createRail, directions, type Stage } from './rail.ts';

test('rail fixed view keeps the operating cab, doors and passenger routes visible while long consists extend outside at six viewport sizes', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createRailScene(h.host, h.make);
    for (const size of [...framingSizes, [320, 568], [900, 400]]) {
      h.resize(size[0], size[1]);
      for (const direction of directions) for (const layout of [0, 1] as const) for (let visit = 0; visit < 4; visit++) {
        for (const phase of ['choose', 'approach', 'door', 'passengers', 'exit'] as Stage[]) for (const fraction of [0, 0.5, 1]) {
          const s = createRail(phase, { direction, layout, palette: 1, cast: 0 }, visit);
          if (phase === 'approach' || phase === 'exit') s.travel = fraction;
          if (phase === 'door') s.door = fraction;
          if (phase === 'passengers') s.elapsed = fraction * (visit < 2 ? 6.9 : 3.7);
          scene.render(s, 0);
          for (const train of s.selected ? [s.selected] : available(s)) {
            h.visible(train === 'tram' ? `rail-${train}` : `rail-${train}-cab`);
            const task = scene.task(s, train);
            for (const p of [task.from, task.to]) assert.ok(p.x >= 12 && p.x <= size[0] - 12 && p.y >= 65 && p.y <= size[1] - 95, `task ${phase} outside usable canvas ${size}`);
          }
          if (phase === 'passengers') for (let id = 0; id < 6; id++) {
            // Offscreen passengers in a future/previous train are intentionally hidden.
            if (Math.floor(id / 3) === visit && visit < 2) h.visible(`rail-passenger-${id}`);
          }
        }
        const departure = createRail('departure', { direction, layout, palette: 0, cast: 0 }, visit); departure.elapsed = 3.8;
        scene.render(departure, 0); const bounds = h.bounds(`rail-${departure.selected}`);
        assert.ok(bounds.max.x < -1 || bounds.min.x > 1, 'whole train leaves before the next visit');
        scene.render(createRail('entrance', { direction, layout, palette: 0, cast: 0 }, visit), 0);
        const incoming = h.bounds(`rail-${departure.selected}`);
        assert.ok(incoming.max.x < -1 || incoming.min.x > 1, 'the entire long consist starts outside the frame');
      }
    }
  })));
});
