import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { DEFAULT_ROUND } from '../../src/missions/house-build/domain/round.ts';
import { createHouse, POUR_TARGETS } from '../../src/missions/house-build/domain/house.ts';

test('concrete follows the foundation centres and aligns an off-centre grip', async ({ page }, info) => {
  const touch = info.project.name === 'tablet-touch', errors = [];
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(state => sessionStorage.setItem('town-crew:play:v1:house-build', JSON.stringify(state)), createHouse('concrete', { ...DEFAULT_ROUND, layout: touch ? 1 : 0 }));
  await page.goto('/#house-build');
  const app = page.locator('#app'), cdp = await page.context().newCDPSession(page);
  await expect(app).toHaveAttribute('data-action', 'ready');
  const rect = await page.locator('canvas').boundingBox(), aspect = rect.width / rect.height, height = Math.max(14.5, 24 / aspect);
  const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 100);
  camera.position.set(8, 10, 18); camera.lookAt(0, 1.8, 0.5); camera.updateMatrixWorld(true);
  const project = (point, y) => {
    const v = new THREE.Vector3(point.x * (touch ? -1 : 1), y, point.z).project(camera);
    return { x: rect.x + (v.x + 1) * rect.width / 2, y: rect.y + (1 - v.y) * rect.height / 2 };
  };
  const down = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }) : (await page.mouse.move(p.x, p.y), page.mouse.down());
  const move = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }) : page.mouse.move(p.x, p.y, { steps: 4 });
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up();
  await page.screenshot({ path: info.outputPath('foundation-centres.png') });
  // Start with the far region and change to the middle before the nearest one.
  const order = [2, 1, 0];
  await down(project({ x: -0.6, z: 1.8 }, 1.1));
  for (const [n, i] of order.entries()) {
    const target = POUR_TARGETS[i];
    await move(project(target, 0.185));
    await expect(app).toHaveAttribute('data-pours', String(n + 1));
    await up();
    const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('town-crew:play:v1:house-build')));
    expect(saved.chute).toEqual(target); expect(saved.pours[i]).toBe(1);
    if (n < 2) {
      // Passing across a region may leave a little concrete, but never fills it.
      expect(saved.pours[0]).toBeLessThan(1);
      await page.screenshot({ path: info.outputPath(`filled-zone-${i}.png`) });
      await down(project({ ...target, x: target.x + 0.2 }, 1.1));
    }
  }
  await expect(app).toHaveAttribute('data-phase', 'delivery-one');
  expect(errors).toEqual([]);
});
