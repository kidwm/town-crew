import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { gesture } from './gesture.mjs';

test('complete road repair, cancellation, partial passes and restart', async ({ page }, testInfo) => {
  const mode = testInfo.project.name === 'tablet-touch' ? 'touch' : 'mouse';
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '修馬路', exact: true }).click();
  const cdp = await page.context().newCDPSession(page);
  const wait = (phase, action) => page.locator(`#app[data-phase="${phase}"]${action ? `[data-action="${action}"]` : ''}`).waitFor();
  const project = async (x, y, z = 0) => {
    const rect = await page.locator('canvas').boundingBox();
    const aspect = rect.width / rect.height;
    const height = Math.max(10.5, 16 / aspect);
    const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 100);
    camera.position.set(6, 8, 16); camera.lookAt(0, 0.4, 0); camera.updateMatrixWorld(true);
    const point = new THREE.Vector3(x, y, z).project(camera);
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
  };
  const down = async point => {
    if (mode === 'mouse') { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
    else await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  };
  const move = async point => {
    if (mode === 'mouse') await page.mouse.move(point.x, point.y, { steps: 12 });
    else await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  };
  const up = async () => mode === 'mouse' ? page.mouse.up() : cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const cancel = async () => mode === 'mouse' ? page.evaluate(() => window.dispatchEvent(new Event('blur'))) : cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });

  await wait('excavator', 'ready');
  await page.mouse.click(700, 640);
  assert.equal(await page.locator('#app').getAttribute('data-cleared'), '0');
  await down(await project(-1.25, 0.85));
  await move(await project(-2, 0.85, -1.65));
  await cancel();
  if (mode === 'mouse') await up();
  await wait('excavator', 'ready');
  assert.equal(await page.locator('#app').getAttribute('data-cleared'), '0');

  for (const [index, rock] of [[1.15, -0.65], [2.35, 0.55], [3.35, -0.45]].entries()) {
    await wait('excavator', 'ready');
    await down(await project(-1.25, 0.85));
    await wait('excavator', 'dragging');
    await move(await project(rock[0], 0.85, rock[1]));
    // Software rendering can finish the brief pickup animation before the
    // last mouse-move event returns. Wait for its durable gameplay result.
    await page.locator(`#app[data-cleared="${index + 1}"]`).waitFor();
    await up();
    if (index === 0) {
      await page.reload();
      await expect(page.locator('#app')).toHaveAttribute('data-cleared', '1');
      await page.getByRole('button', { name: '回到選關', exact: true }).click();
      await page.getByRole('button', { name: '蓋房子', exact: true }).click();
      await expect(page.locator('#app')).toHaveAttribute('data-phase', 'gravel');
      await page.getByRole('button', { name: '回到選關', exact: true }).click();
      await page.getByRole('button', { name: '修馬路', exact: true }).click();
      await expect(page.locator('#app')).toHaveAttribute('data-cleared', '0');
      await expect(page.locator('canvas')).toHaveCount(1);
      await wait('excavator', 'ready');
      await down(await project(-1.25, 0.85));
      await move(await project(rock[0], 0.85, rock[1]));
      await expect(page.locator('#app')).toHaveAttribute('data-cleared', '1');
      await up();
    }
  }
  await wait('dump-truck', 'ready');
  const tipping = await gesture(page, 'up');
  await page.screenshot({ path: testInfo.outputPath('truck.png') });
  const bed = tipping.from;
  await down(bed); await up(); await wait('dump-truck', 'ready');
  assert.equal(await page.locator('#app').getAttribute('data-passes'), '0');
  await down(bed); await move({ ...bed, y: bed.y - 25 }); await cancel();
  if (mode === 'mouse') await up();
  await wait('dump-truck', 'ready');
  await down(bed); await move(tipping.to); await up();
  await wait('roller', 'ready');

  const outward = await gesture(page, 'right');
  await page.screenshot({ path: testInfo.outputPath('roller-gesture.png') });
  await down(outward.from);
  await move({ x: (outward.from.x + outward.to.x) / 2, y: (outward.from.y + outward.to.y) / 2 });
  await expect(page.locator('.drag-hint')).toBeHidden();
  await up();
  await wait('roller', 'ready');
  assert.equal(await page.locator('#app').getAttribute('data-passes'), '0');
  const remaining = await gesture(page, 'right');
  await down(remaining.from);
  await move(remaining.to); await up();
  await page.locator('#app[data-phase="roller"][data-action="ready"][data-passes="1"]').waitFor();
  const returning = await gesture(page, 'left');
  await page.screenshot({ path: testInfo.outputPath('roller-return-gesture.png') });
  await down(returning.from);
  await move(returning.to); await up();
  await wait('traffic');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: testInfo.outputPath('traffic.png') });
  await wait('complete');
  assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'), '100');
  assert.equal(await page.locator('[data-step][data-state="done"]').count(), 3);
  await page.screenshot({ path: testInfo.outputPath('complete.png') });
  await page.getByRole('button', { name: '重新開始修路任務' }).click();
  await wait('excavator', 'ready');
  assert.equal(await page.locator('#app').getAttribute('data-cleared'), '0');
  assert.equal(await page.locator('#app').getAttribute('data-passes'), '0');
  assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'), '0');
  assert.deepEqual(errors, []);
});

test('production ignores development stage shortcuts', async ({ page }) => {
  await page.goto('/?dev=1&stage=complete');
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.getByRole('button', { name: '修馬路', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'excavator');
  await expect(page.locator('.dev-panel')).toHaveCount(0);
  await expect(page.locator('.success')).toBeHidden();
});
