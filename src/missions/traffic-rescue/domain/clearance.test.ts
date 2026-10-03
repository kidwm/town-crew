import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { createShapes } from '../../../runtime/geometry.ts';
import { createAmbulance } from '../../../runtime/emergency-models.ts';
import { createTrafficCone } from '../../../runtime/traffic-cone.ts';
import { createSweeper } from '../vehicles.ts';
import { AMBULANCE_LANE, CONES, reopeningCarX, REOPEN_PASS_START } from './traffic.ts';

test('placed cones clear the actual ambulance and sweeper models throughout their routes', () => {
  const shapes = createShapes(), ambulance = createAmbulance(shapes), sweeper = createSweeper(shapes);
  const cones = CONES.map(p => { const cone = createTrafficCone(shapes); cone.position.set(p.x, 0, p.z); return new Box3().setFromObject(cone); });
  // Include the generous invisible vehicle hitboxes as an extra clearance margin.
  for (const [vehicle, z] of [[ambulance, AMBULANCE_LANE], [sweeper, 0]] as const) {
    for (let x = -17; x <= 29; x += 0.2) {
      vehicle.root.position.set(x, 0, z);
      const bounds = new Box3().setFromObject(vehicle.root);
      for (const cone of cones) assert.ok(!bounds.intersectsBox(cone), `vehicle at ${x}, ${z} overlaps a cone`);
    }
  }
  ambulance.root.position.set(5.6, 0, AMBULANCE_LANE);
  for (let open = 0; open <= 1; open += 0.05) {
    ambulance.open(open);
    for (const cone of cones) assert.ok(!new Box3().setFromObject(ambulance.root).intersectsBox(cone), 'opening rear doors overlaps a cone');
  }
  shapes.disposeMaterials();
});

test('the crossing car never exceeds the road-repair car’s ten-unit peak speed', () => {
  for (let t = REOPEN_PASS_START; t < REOPEN_PASS_START + 6.6; t += 0.01) {
    const speed = (reopeningCarX(t + 0.01) - reopeningCarX(t)) / 0.01;
    assert.ok(speed >= 0 && speed <= 10.00001);
  }
});
