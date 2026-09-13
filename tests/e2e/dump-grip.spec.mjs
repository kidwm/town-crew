import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { createHouse } from '../../src/missions/house-build/domain/house.ts';
import { createRoad } from '../../src/missions/road-repair/domain/road.ts';
import { defaultTuning } from '../../src/missions/road-repair/domain/dump-truck.ts';
import { gesture } from './gesture.mjs';

test('both dump trucks accept the front rim, nearby fingers and existing centre grips', async ({ page }, info) => {
  const touch = info.project.name === 'tablet-touch', errors = [];
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ house, road }) => {
    sessionStorage.setItem('town-crew:play:v1:house-build', JSON.stringify(house));
    sessionStorage.setItem('town-crew:play:v1:road-repair', JSON.stringify(road));
  }, { house: createHouse(), road: { key: 'play', state: createRoad('dump-truck'), tuning: defaultTuning, targetStage: 'dump-truck' } });
  await page.goto('/');
  const app = page.locator('#app'), cdp = await page.context().newCDPSession(page);
  const down = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }) : (await page.mouse.move(p.x, p.y), page.mouse.down());
  const move = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }) : page.mouse.move(p.x, p.y, { steps: 4 });
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up();
  const cancel = async () => {
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    else { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up(); }
  };
  for (const house of [true, false]) {
    const phase = house ? 'gravel' : 'dump-truck';
    await page.getByRole('button', { name: house ? '蓋房子' : '修馬路', exact: true }).click();
    await expect(app).toHaveAttribute('data-phase', phase);
    await expect(app).toHaveAttribute('data-action', 'ready');
    const rect = await page.locator('canvas').boundingBox(), aspect = rect.width / rect.height;
    const height = house ? Math.max(14.5, 24 / aspect) : Math.max(10.5, 16 / aspect);
    const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 100);
    camera.position.set(...(house ? [8, 10, 18] : [6, 8, 16]));
    camera.lookAt(...(house ? [0, 1.8, 0.5] : [0, 0.4, 0])); camera.updateMatrixWorld(true);
    const project = (x, y, z) => {
      const p = new THREE.Vector3(x, y, z).project(camera);
      return { x: rect.x + (p.x + 1) * rect.width / 2, y: rect.y + (1 - p.y) * rect.height / 2 };
    };
    const front = project(house ? -3.75 : -2.67, house ? 2.05 : 2.11, 0.85);
    const farCorner = project(house ? -3.75 : -2.67, house ? 2.05 : 2.11, -0.85);
    const centre = house ? project(-2.4, 1.7, 0) : project(-1.75, 1.65, 0.7);
    const hint = await gesture(page, 'up');
    expect(Math.hypot(hint.from.x - front.x, hint.from.y - front.y)).toBeLessThan(1);
    await page.screenshot({ path: info.outputPath(`${phase}-front-grip.png`) });
    // Partial pulls from the rim, either padded corner, and the old centre
    // must all grab successfully and remain retryable after cancellation.
    for (const start of [front, { x: front.x - 20, y: front.y - 16 }, { x: farCorner.x - 20, y: farCorner.y - 16 }, centre]) {
      await down(start); await expect(app).toHaveAttribute('data-action', 'dragging');
      await move({ ...start, y: start.y - 25 });
      await expect(page.locator('.drag-hint')).toBeHidden();
      await cancel(); await expect(app).toHaveAttribute('data-action', 'ready');
      await expect(app).toHaveAttribute('data-phase', phase);
    }
    const empty = { x: rect.x + rect.width - 20, y: rect.y + rect.height * 0.25 };
    await down(empty); await move({ ...empty, y: empty.y - 80 }); await up();
    await expect(app).toHaveAttribute('data-action', 'ready');
    await down(hint.from); await move(hint.to); await up();
    await expect(app).toHaveAttribute('data-phase', house ? 'concrete' : 'roller');
    await page.getByRole('button', { name: '回到選關', exact: true }).click();
  }
  expect(errors).toEqual([]);
});
