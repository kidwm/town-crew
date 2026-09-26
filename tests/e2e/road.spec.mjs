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
    const mirrored = await page.locator('#app').getAttribute('data-layout') === '1';
    const point = new THREE.Vector3(mirrored ? -x : x, y, z).project(camera);
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
  const center = async selector => {
    const rect = await page.locator(selector).boundingBox();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };
  const excavationGesture = async () => {
    await expect(page.locator('.drag-hint')).toBeVisible();
    return gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
  };

  await wait('excavator', 'ready');
  await expect(page.locator('.drag-hint')).toHaveAttribute('aria-label', '拖過去，挖起來');
  await expect(page.locator('.excavator-grip')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('broken-road-and-empty-hauler.png') });
  await page.mouse.click(700, 640);
  assert.equal(await page.locator('#app').getAttribute('data-cleared'), '0');
  await down(await project(-1.25, 0.85));
  await move(await project(-2, 0.85, -1.65));
  await cancel();
  if (mode === 'mouse') await up();
  await wait('excavator', 'ready');
  assert.equal(await page.locator('#app').getAttribute('data-cleared'), '0');

  for (let index = 0; index < 3; index++) {
    await wait('excavator', 'ready');
    const digging = await excavationGesture();
    await down(digging.from);
    await wait('excavator', 'dragging');
    await expect(page.locator('.drag-hint')).toBeHidden();
    await move(digging.to);
    await wait('excavator', 'carrying-drag');
    await expect(page.locator('#app')).toHaveAttribute('data-loaded', String(index));
    await expect(page.locator('#app')).toHaveAttribute('data-bucket-loaded', 'true');
    await page.waitForTimeout(550);
    await expect(page.locator('#app')).toHaveAttribute('data-loaded', String(index));
    if (index === 0) {
      await up();
      await wait('excavator', 'carrying');
      await expect(page.locator('.drag-hint')).toBeHidden();
      await expect(page.locator('.drag-hint')).toBeVisible();
      await expect(page.locator('.drag-hint')).toHaveAttribute('aria-label', '拖到車斗，放開');
      await page.screenshot({ path: testInfo.outputPath('carrying-hint.png') });
      await page.reload();
      await wait('excavator', 'carrying');
      await expect(page.locator('#app')).toHaveAttribute('data-bucket-loaded', 'true');
      const delivering = await excavationGesture();
      await down(delivering.from); await move(delivering.to);
      await expect(page.locator('.excavator-drop')).toHaveAttribute('data-ready', 'true');
      await page.screenshot({ path: testInfo.outputPath('ready-to-drop.png') });
      await cancel(); if (mode === 'mouse') await up();
      await wait('excavator', 'carrying');
      await expect(page.locator('#app')).toHaveAttribute('data-loaded', '0');
      await down(await center('.excavator-grip'));
    }
    await move(await center('.excavator-drop'));
    await expect(page.locator('.excavator-drop')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#app')).toHaveAttribute('data-loaded', String(index));
    await up();
    await page.locator(`#app[data-cleared="${index + 1}"]`).waitFor();
    if (index === 0) {
      await expect(page.locator('#app')).toHaveAttribute('data-loaded', '1');
      await page.screenshot({ path: testInfo.outputPath('first-chunk-loaded.png') });
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
      const retry = await excavationGesture();
      await down(retry.from); await move(retry.to);
      await wait('excavator', 'carrying-drag');
      await move(await center('.excavator-drop'));
      await up();
      await expect(page.locator('#app')).toHaveAttribute('data-cleared', '1');
    }
  }
  await wait('haul-away', 'ready');
  await expect(page.locator('#app')).toHaveAttribute('data-loaded', '3');
  await page.screenshot({ path: testInfo.outputPath('loaded-hauler.png') });
  const mirrored = await page.locator('#app').getAttribute('data-layout') === '1';
  let hauling = await gesture(page, mirrored ? 'right' : 'left');
  await down(hauling.from); await up(); await wait('haul-away', 'ready');
  await down(hauling.from);
  await move({ x: (hauling.from.x + hauling.to.x) / 2, y: (hauling.from.y + hauling.to.y) / 2 });
  await cancel(); if (mode === 'mouse') await up();
  await wait('haul-away', 'ready');
  const haulX = await page.locator('#app').getAttribute('data-haul-x');
  expect(Number(haulX)).toBeLessThan(1.8); expect(Number(haulX)).toBeGreaterThan(-3.8);
  await page.reload(); await wait('haul-away', 'ready');
  await expect(page.locator('#app')).toHaveAttribute('data-haul-x', haulX);
  await expect(page.locator('#app')).toHaveAttribute('data-loaded', '3');
  hauling = await gesture(page, mirrored ? 'right' : 'left');
  await down(hauling.from); await move(hauling.to);
  await wait('dump-truck', 'ready');
  await expect(page.locator('#app')).toHaveAttribute('data-loaded', '0');
  // A held finger from hauling cannot tip the next truck.
  await expect(page.locator('#app')).toHaveAttribute('data-action', 'ready');
  await up();
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

  const outward = await gesture(page, mirrored ? 'left' : 'right');
  await page.screenshot({ path: testInfo.outputPath('roller-gesture.png') });
  await down(outward.from);
  await move({ x: (outward.from.x + outward.to.x) / 2, y: (outward.from.y + outward.to.y) / 2 });
  await expect(page.locator('.drag-hint')).toBeHidden();
  await up();
  await wait('roller', 'ready');
  assert.equal(await page.locator('#app').getAttribute('data-passes'), '0');
  const remaining = await gesture(page, mirrored ? 'left' : 'right');
  await down(remaining.from);
  await move(remaining.to); await up();
  await page.locator('#app[data-phase="roller"][data-action="ready"][data-passes="1"]').waitFor();
  const returning = await gesture(page, mirrored ? 'right' : 'left');
  await page.screenshot({ path: testInfo.outputPath('roller-return-gesture.png') });
  await down(returning.from);
  await move(returning.to); await up();
  await wait('traffic');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: testInfo.outputPath('traffic.png') });
  await wait('complete');
  assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'), '100');
  assert.equal(await page.locator('[data-step][data-state="done"]').count(), 4);
  await page.screenshot({ path: testInfo.outputPath('complete.png') });
  await page.reload(); await wait('complete');
  await page.screenshot({ path: testInfo.outputPath('complete-reloaded.png') });
  const previousPattern = await page.locator('#app').getAttribute('data-pattern');
  await page.getByRole('button', { name: '重新開始修路任務' }).click();
  await wait('excavator', 'ready');
  assert.equal(await page.locator('#app').getAttribute('data-cleared'), '0');
  await expect(page.locator('#app')).toHaveAttribute('data-loaded', '0');
  assert.equal(await page.locator('#app').getAttribute('data-passes'), '0');
  assert.equal(await page.locator('.progress').getAttribute('aria-valuenow'), '0');
  await expect(page.locator('#app')).not.toHaveAttribute('data-pattern', previousPattern);
  await expect(page.locator('#app')).toHaveAttribute('data-layout', mirrored ? '0' : '1');
  await page.screenshot({ path: testInfo.outputPath('site-restored.png') });
  assert.deepEqual(errors, []);
});

test('excavator supports tap destinations and keyboard without a drag', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#road-repair');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await expect(page.locator('.drag-hint')).toBeVisible();
  const mirrored = await app.getAttribute('data-layout') === '1';
  const digging = await gesture(page, mirrored ? 'left' : 'right');
  const tap = async point => testInfo.project.name === 'tablet-touch'
    ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y);
  await tap(digging.from);
  await expect(app).toHaveAttribute('data-bucket-selected', 'true');
  await expect(app).toHaveAttribute('data-loaded', '0');
  await tap(digging.to);
  await expect(app).toHaveAttribute('data-action', 'carrying');
  await expect(app).toHaveAttribute('data-loaded', '0');
  const bed = await page.locator('.excavator-drop').boundingBox();
  await tap({ x: bed.x + bed.width / 2, y: bed.y + bed.height / 2 });
  await expect(app).toHaveAttribute('data-loaded', '1');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await page.locator('canvas').focus();
  await page.keyboard.press('Enter');
  await expect(app).toHaveAttribute('data-bucket-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(app).toHaveAttribute('data-bucket-selected', 'false');
  await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await expect(app).toHaveAttribute('data-action', 'carrying');
  await page.keyboard.press('Enter');
  await expect(app).toHaveAttribute('data-loaded', '2');
});

test('production ignores development stage shortcuts', async ({ page }) => {
  await page.goto('/?dev=1&stage=complete');
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.getByRole('button', { name: '修馬路', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'excavator');
  await expect(page.locator('.dev-panel')).toHaveCount(0);
  await expect(page.locator('.success')).toBeHidden();
});
