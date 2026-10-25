import test from 'node:test';
import { Effect } from 'effect';
import { framingHarness, framingSizes } from '../../../../tests/helpers/framing.ts';
import { createScene } from '../scene.ts';
import { createRoad, HAUL_EXIT, ROLLER_LEFT, ROLLER_RIGHT } from './road.ts';
import { defaultTuning } from './dump-truck.ts';
import { HOME, UNLOAD, CARRY_HEIGHT, reachable } from './excavator.ts';
import { DAMAGE_PATTERNS } from './round.ts';

test('fixed road frame retains both layouts, raised tools and manual travel endpoints', async t => {
  const h = framingHarness(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* createScene(h.host, h.make);
    for (const [width, height] of framingSizes) {
      h.resize(width, height);
      for (const layout of [0, 1] as const) for (const pattern of DAMAGE_PATTERNS) {
        const round = { layout, pattern }, s = createRoad('excavator', round); s.access = 'working'; s.excavator.action = 'ready';
        for (const point of [HOME, UNLOAD, ...[-2, 4.3].flatMap(x => [-3, 1.65].map(z => ({ x, y: CARRY_HEIGHT, z })))]) {
          s.excavator.bucket = reachable(point); scene.render(s, defaultTuning, 0); h.visible('excavator'); h.visible('cleanup-truck');
        }
        const haul = createRoad('haul-away', round); haul.hauler.x = HAUL_EXIT; scene.render(haul, defaultTuning, 0); h.visible('cleanup-truck');
        const dump = createRoad('dump-truck', round); dump.access = 'working'; dump.truck.phase = 'dumping'; dump.truck.elapsed = 0.5;
        scene.render(dump, defaultTuning, 0); h.visible('dump-truck');
        const roller = createRoad('roller', round); roller.access = 'working'; roller.roller.action = 'ready';
        for (const x of [ROLLER_LEFT, ROLLER_RIGHT]) { roller.roller.x = x; scene.render(roller, defaultTuning, 0); h.visible('road-roller'); }
      }
    }
  })));
});
