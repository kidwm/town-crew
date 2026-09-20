import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTraffic, CARS, towHome } from './traffic.ts';
import { towingPose, towedCarPose, CAR_AXLE, CAR_WHEEL, LIFT_AXLE_X, LIFT_HEIGHT } from './towing.ts';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);
test('waiting for a tool does not load or rotate the selected car', () => {
  for (const selected of [0, 1] as const) {
    const s = { ...createTraffic('hook'), selected };
    assert.deepEqual(towedCarPose(s, selected).position, CARS[selected]);
    assert.ok(Math.abs(towHome(s).x - CARS[selected].x) > 2);
  }
});
test('wheel lift keeps the trailing axle on the road and the front axle on the yoke on both sides', () => {
  for (const selected of [0, 1] as const) {
    const s = createTraffic('hook', [0, 2], selected === 0 ? ['wheel-lift', 'flatbed'] : ['flatbed', 'wheel-lift']);
    s.selected = selected; s.action = 'working';
    for (let t = 3.6; t <= 4.5; t += 0.05) {
      s.elapsed = t;
      const rig = towingPose(s), car = towedCarPose(s, selected), sin = Math.sin(car.pitch), cos = Math.cos(car.pitch);
      close(car.position.y - CAR_AXLE * sin + CAR_WHEEL * cos, CAR_WHEEL);
      close(car.position.y + CAR_AXLE * sin + CAR_WHEEL * cos, CAR_WHEEL + rig.raised * LIFT_HEIGHT);
      close(car.position.x + rig.direction * (CAR_AXLE * cos - CAR_WHEEL * sin), rig.x + rig.direction * LIFT_AXLE_X);
    }
    s.phase = 'tow-exit'; s.action = 'ready'; s.truckX = selected === 0 ? -8 : 8;
    const parked = towedCarPose(s, selected); s.truckX *= 11 / 8;
    close(towedCarPose(s, selected).position.y, parked.position.y);
  }
});
test('both rigs back in, load through the clear apron, then keep the car behind the cab on departure', () => {
  for (const pair of [['flatbed', 'wheel-lift'], ['wheel-lift', 'flatbed']] as const) for (const selected of [0, 1] as const) {
    const s = createTraffic('tow-arrival', [0, 2], [...pair]); s.selected = selected;
    const entry = towingPose(s); s.elapsed = 2; const parked = towingPose(s);
    assert.ok(Math.abs(entry.x) > Math.abs(parked.x)); close(parked.x, selected === 0 ? -8 : 8);
    s.phase = 'hook'; s.action = 'working'; s.elapsed = 1.3;
    close(towedCarPose(s, selected).position.z, parked.z);
    assert.ok(Math.abs(parked.z - CARS[1 - selected].z) > 3);
    s.elapsed = 4.5; const loaded = towedCarPose(s, selected);
    s.phase = 'tow-exit'; s.action = 'ready'; s.truckX = parked.x;
    assert.deepEqual(towedCarPose(s, selected), loaded);
    assert.ok((loaded.position.x - parked.x) * parked.direction < 0);
    s.truckX = 11 * parked.direction; s.action = 'working'; s.elapsed = 1.5;
    assert.ok(Math.abs(towedCarPose(s, selected).position.x) > 20);
  }
});
