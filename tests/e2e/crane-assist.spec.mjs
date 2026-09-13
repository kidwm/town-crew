import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { createHouse, HOUSE, PARTS } from '../../src/missions/house-build/domain/house.ts';
import { withPausedClock } from './timing.mjs';

test('crane accepts the assembly base without release and consumes only the current drag', async ({ page }, info) => {
  const touch = info.project.name === 'tablet-touch', errors = [];
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.addInitScript(state => sessionStorage.setItem('town-crew:play:v1:house-build', JSON.stringify(state)), createHouse('crane-one'));
  await page.goto('/#house-build');
  const app = page.locator('#app'), cdp = await page.context().newCDPSession(page);
  const ready = () => expect(app).toHaveAttribute('data-action', 'ready');
  await ready();
  const rect = await page.locator('canvas').boundingBox(), aspect = rect.width / rect.height, height = Math.max(14.5, 24 / aspect);
  const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 100);
  camera.position.set(8, 10, 18); camera.lookAt(0, 1.8, 0.5); camera.updateMatrixWorld(true);
  const project = (x, y, z) => {
    const p = new THREE.Vector3(x, y, z).project(camera);
    return { x: rect.x + (p.x + 1) * rect.width / 2, y: rect.y + (1 - p.y) * rect.height / 2 };
  };
  const down = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }) : (await page.mouse.move(p.x, p.y), page.mouse.down());
  const move = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }) : page.mouse.move(p.x, p.y);
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up();
  const cancel = async () => {
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    else { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up(); }
  };
  const source = project(-4.2, 3.9, 1.2), base = project(HOUSE.x + 0.7, PARTS[0].base + 0.03, HOUSE.z + 1.5);
  const outside = { x: 20, y: rect.height * 0.3 };
  const indicator = page.getByRole('img', { name: '吊車放置位置' }), circle = await indicator.boundingBox();
  const baseCentre = project(HOUSE.x, PARTS[0].base + 0.03, HOUSE.z);
  expect(Math.hypot(circle.x + circle.width / 2 - baseCentre.x, circle.y + circle.height / 2 - baseCentre.y)).toBeLessThan(1);
  await page.screenshot({ path: info.outputPath('assembly-base-target.png') });

  await down(source);
  await page.waitForTimeout(650);
  await expect(app).toHaveAttribute('data-action', 'dragging');
  await expect(app).toHaveAttribute('data-placed', '0');
  // Passing through the destination does not install it after the finger leaves.
  await withPausedClock(page, async () => {
    await move(base); await page.clock.runFor(120); await move(outside);
  });
  await page.waitForTimeout(650);
  await expect(app).toHaveAttribute('data-action', 'dragging');
  await expect(app).toHaveAttribute('data-placed', '0');
  await cancel(); await ready();
  // Cancellation at an otherwise valid destination still cancels the dwell.
  await withPausedClock(page, async () => {
    await down(source); await move(base); await page.clock.runFor(120); await cancel();
  });
  await ready();
  await expect(app).toHaveAttribute('data-placed', '0');

  await down(source); await move(base);
  await expect(app).toHaveAttribute('data-placed', '1');
  await ready();
  // The same held finger cannot grab the next load or repeatedly build parts.
  const nextSource = project(-1.1, 3.9, 0.2);
  await move(nextSource); await move(base);
  await page.waitForTimeout(650);
  await expect(app).toHaveAttribute('data-placed', '1');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await up();

  // A visible wall face works too, not just the footprint or its central marker.
  await down(nextSource); await move(project(HOUSE.x + 1, 1.7, HOUSE.z));
  await expect(app).toHaveAttribute('data-placed', '2'); await up(); await ready();
  // Preserve the learned elevated target and early-release interaction.
  await down(project(-2.4, 3.22, 0.2));
  await move(project(HOUSE.x, PARTS[2].lift + PARTS[2].height / 2, HOUSE.z)); await up();
  await expect(app).toHaveAttribute('data-placed', '3');
  await page.screenshot({ path: info.outputPath('first-floor-assisted.png') });
  expect(errors).toEqual([]);
});
