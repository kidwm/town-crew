import { test, expect } from '@playwright/test';
import { utimes } from 'node:fs/promises';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';
import * as THREE from 'three';

test('mirrored road lets the child drag past nearer pieces and retains the chosen load through reload and HMR', async ({ page }) => {
  await page.goto('/?dev=1&stage=excavator&pattern=split&layout=1');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-action', 'ready');
  const rect = await page.locator('canvas').boundingBox();
  const aspect = rect.width / rect.height, height = Math.max(10.5, 16 / aspect);
  const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 100);
  camera.position.set(6, 8, 16); camera.lookAt(0, 0.4, 0); camera.updateMatrixWorld(true);
  const far = new THREE.Vector3(-3.5, 0.11, 0.1).project(camera);
  const grip = await page.locator('.excavator-grip').boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + (far.x + 1) * rect.width / 2, rect.y + (1 - far.y) * rect.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(app).toHaveAttribute('data-action', 'carrying');
  await expect(app).toHaveAttribute('data-carried', '2');
  await page.reload();
  await expect(app).toHaveAttribute('data-action', 'carrying');
  const world = await page.locator('.world').elementHandle(), now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await page.waitForFunction(element => !element.isConnected, world);
  await expect(app).toHaveAttribute('data-action', 'carrying');
  await expect(app).toHaveAttribute('data-carried', '2');
  await expect(app).toHaveAttribute('data-pattern', 'split');
  await expect(app).toHaveAttribute('data-layout', '1');
  await expect(app).toHaveAttribute('data-loaded', '0');
  await page.locator('canvas').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await expect(app).toHaveAttribute('data-delivered', '2');
  await expect(app).toHaveAttribute('data-action', 'ready');
});

test('fire rescue reload, HMR and stage reset preserve the selected passenger progress', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?dev=1&mission=fire-rescue&stage=rescue');
  const app = page.locator('#app'), { wait, dragGoal, up } = await fireControls(page);
  await wait('rescue'); await dragGoal('cat');
  await expect(app).toHaveAttribute('data-cat', 'true'); await up();
  await page.reload(); await wait('rescue');
  await expect(app).toHaveAttribute('data-cat', 'true'); await expect(app).toHaveAttribute('data-resident', 'false');
  const world = await page.locator('.world').elementHandle(), now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await page.waitForFunction(element => !element.isConnected, world);
  await wait('rescue'); await expect(app).toHaveAttribute('data-cat', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '重設目前階段' }).click();
  await expect(app).toHaveAttribute('data-rescued', '0');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await page.getByRole('button', { name: '消防隊救火', exact: true }).click();
  await wait('dispatch'); await expect(app).toHaveAttribute('data-extinguished', '0');
  expect(errors).toEqual([]);
});

test('development entry, reload, HMR and stage reset retain useful progress', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/?dev=1&stage=roller-return');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-passes', '1');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await page.locator('#threshold').fill('90');
  await expect(page.locator('#threshold-value')).toHaveText('90 px');
  await page.reload();
  await expect(app).toHaveAttribute('data-passes', '1');
  await expect(page.locator('#threshold')).toHaveValue('90');

  const world = await page.locator('.world').elementHandle();
  // Trigger Vite's file watcher without rewriting source or racing local edits.
  const now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await page.waitForFunction(element => !element.isConnected, world);
  await expect(app).toHaveAttribute('data-passes', '1');
  await expect(page.locator('#threshold')).toHaveValue('90');
  await expect(page.locator('canvas')).toHaveCount(1);

  await page.locator('#stage').selectOption('dump-truck');
  await expect(app).toHaveAttribute('data-phase', 'dump-truck');
  await expect(app).toHaveAttribute('data-action', 'ready');
  // Freeze the short gate animation while the native click is dispatched.
  await withPausedClock(page, async () => {
    await page.getByRole('button', { name: '重設目前階段' }).click();
    await page.clock.runFor(32);
    await expect(app).toHaveAttribute('data-action', 'opening-entry');
  });
  await expect(app).toHaveAttribute('data-action', 'ready');
  expect(errors).toEqual([]);
});

test('road cleanup development entry preserves cargo and a partial drive across reload and HMR', async ({ page }) => {
  const { gesture } = await import('./gesture.mjs');
  await page.goto('/?dev=1&stage=haul-away&pattern=clustered&layout=1');
  const app = page.locator('#app'), { wait, down, move, cancel } = await fireControls(page);
  await wait('haul-away'); await expect(app).toHaveAttribute('data-loaded', '3');
  const hint = await gesture(page, 'right');
  await down(hint.from); await move({ x: (hint.from.x + hint.to.x) / 2, y: (hint.from.y + hint.to.y) / 2 });
  await cancel(); await page.mouse.up(); await wait('haul-away');
  const x = await app.getAttribute('data-haul-x');
  expect(Number(x)).toBeLessThan(1.8); expect(Number(x)).toBeGreaterThan(-3.8);
  await page.reload(); await wait('haul-away'); await expect(app).toHaveAttribute('data-haul-x', x);
  const world = await page.locator('.world').elementHandle(), now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await page.waitForFunction(element => !element.isConnected, world);
  await wait('haul-away'); await expect(app).toHaveAttribute('data-haul-x', x); await expect(app).toHaveAttribute('data-loaded', '3');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '重設目前階段' }).click();
  await wait('haul-away'); await expect(app).toHaveAttribute('data-haul-x', '1.8');
  await page.locator('#stage').selectOption('excavator'); await wait('excavator');
  await expect(app).toHaveAttribute('data-loaded', '0');
  await expect(app).toHaveAttribute('data-pattern', 'clustered');
  await expect(app).toHaveAttribute('data-layout', '1');
  await page.locator('#road-pattern').selectOption('split');
  await expect(app).toHaveAttribute('data-pattern', 'split');
  await expect(app).toHaveAttribute('data-layout', '1');
  await page.locator('#road-layout').selectOption('0');
  await expect(app).toHaveAttribute('data-layout', '0');
});

test('house development stages, reload and HMR preserve the round and second floor', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?dev=1&mission=house-build&stage=crane-two&roof=flat&layout=1&palette=2&family=2&pet=dog');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-phase', 'crane-two');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await expect(app).toHaveAttribute('data-placed', '3');
  await expect(app).toHaveAttribute('data-roof', 'flat'); await expect(app).toHaveAttribute('data-layout', '1'); await expect(app).toHaveAttribute('data-pet', 'dog');
  await page.reload();
  await expect(app).toHaveAttribute('data-placed', '3');
  await expect(app).toHaveAttribute('data-roof', 'flat'); await expect(app).toHaveAttribute('data-layout', '1'); await expect(app).toHaveAttribute('data-pet', 'dog');
  const world = await page.locator('.world').elementHandle();
  const now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await page.waitForFunction(element => !element.isConnected, world);
  await expect(app).toHaveAttribute('data-placed', '3');
  await expect(app).toHaveAttribute('data-roof', 'flat'); await expect(app).toHaveAttribute('data-layout', '1'); await expect(app).toHaveAttribute('data-pet', 'dog');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('#stage').selectOption('concrete');
  await expect(app).toHaveAttribute('data-roof', 'flat'); await expect(app).toHaveAttribute('data-layout', '1');
  await expect(app).toHaveAttribute('data-pours', '0');
  await expect(app).toHaveAttribute('data-placed', '0');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await page.getByRole('button', { name: '重設目前階段' }).click();
  await expect(app).toHaveAttribute('data-action', 'entering');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await page.locator('#house-roof').selectOption('shed'); await expect(app).toHaveAttribute('data-roof', 'shed');
  await expect(app).toHaveAttribute('data-layout', '1');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await page.getByRole('button', { name: '修馬路', exact: true }).click();
  await expect(app).toHaveAttribute('data-phase', 'excavator');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await page.getByRole('button', { name: '蓋房子', exact: true }).click();
  await expect(app).toHaveAttribute('data-phase', 'gravel');
  await expect(app).toHaveAttribute('data-placed', '0');
  await expect(app).toHaveAttribute('data-pours', '0');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('traffic development reload and HMR retain partial cleaning and colours with a single canvas', async ({ page }) => {
  const { gesture } = await import('./gesture.mjs');
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?dev=1&mission=traffic-rescue&stage=sweep');
  const app = page.locator('#app'), { wait, down, move, cancel } = await fireControls(page);
  await wait('sweep'); const colors = await app.getAttribute('data-colors'), towTypes = await app.getAttribute('data-tow-types');
  const h = await gesture(page, 'right'); await down(h.from); await move({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 }); await cancel();
  const cleaned = await app.getAttribute('data-cleaned'); expect(Number(cleaned)).toBeGreaterThan(0);
  await page.reload(); await wait('sweep'); await expect(app).toHaveAttribute('data-cleaned', cleaned); await expect(app).toHaveAttribute('data-colors', colors);
  const world = await page.locator('.world').elementHandle(), now = new Date(); await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await page.waitForFunction(e => !e.isConnected, world); await wait('sweep'); await expect(app).toHaveAttribute('data-cleaned', cleaned); await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '重設目前階段' }).click(); await expect(app).toHaveAttribute('data-cleaned', '0');
  await page.locator('#stage').selectOption('hook'); await wait('hook'); await expect(app).toHaveAttribute('data-towed', '0');
  await expect(app).toHaveAttribute('data-tow-types', towTypes);
  await page.getByRole('button', { name: '回到選關', exact: true }).click(); await page.getByRole('button', { name: '交通救援隊', exact: true }).click(); await wait('police');
  await expect(app).toHaveAttribute('data-towed', '0'); expect(errors).toEqual([]);
});

test('house arrival HMR keeps the parked car and ongoing walk at the same instant', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install(); await page.clock.pauseAt(Date.now() + 1000);
  await page.goto('/?dev=1&mission=house-build&stage=decorate&layout=1&family=2&pet=cat');
  const app = page.locator('#app');
  async function mounted() {
    await expect(page.locator('canvas')).toHaveCount(1); await expect(page.locator('.loading')).toHaveCount(0);
    await page.clock.runFor(32);
  }
  await mounted(); await page.clock.runFor(7200);
  await expect(app).toHaveAttribute('data-arrival', 'walking');
  const before = Number(await app.getAttribute('data-arrival-time'));
  const world = await page.locator('.world').elementHandle(), now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await expect.poll(() => page.evaluate(element => !element.isConnected, world)).toBe(true);
  await mounted();
  await expect(app).toHaveAttribute('data-arrival', 'walking');
  expect(Math.abs(Number(await app.getAttribute('data-arrival-time')) - before)).toBeLessThan(0.05);
  await expect(app).toHaveAttribute('data-layout', '1'); await expect(app).toHaveAttribute('data-pet', 'cat');
  await page.clock.runFor(3000); await expect(app).toHaveAttribute('data-phase', 'complete');
  expect(errors).toEqual([]);
});

test('traffic reload during wheel lifting keeps the same car, rig and animation position', async ({ page }) => {
  const { gesture } = await import('./gesture.mjs');
  await page.addInitScript(() => { Math.random = () => 0.75; }); await page.clock.install();
  await page.goto('/?dev=1&mission=traffic-rescue&stage=hook');
  const app = page.locator('#app'), { down, up, wait } = await fireControls(page);
  await wait('hook'); await expect(app).toHaveAttribute('data-tow-type', 'wheel-lift');
  const key = 'town-crew:traffic:dev:v1:?dev=1&mission=traffic-rescue&stage=hook';
  await withPausedClock(page, async () => {
    const h = await gesture(page, 'up'), r = await page.locator('.traffic-target').boundingBox();
    await down(h.from); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.clock.runFor(4300); await up();
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const before = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key);
    expect(before.phase).toBe('hook'); expect(before.action).toBe('working');
    expect(before.elapsed).toBeGreaterThan(3.6); expect(before.elapsed).toBeLessThan(4.5);
    await page.reload(); await page.clock.runFor(32); await wait('hook', 'working');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const after = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key);
    expect(after.selected).toBe(before.selected); expect(after.towTypes).toEqual(before.towTypes);
    expect(Math.abs(after.elapsed - before.elapsed)).toBeLessThan(0.1);
    await expect(page.locator('canvas')).toHaveCount(1);
  });
  await wait('tow-exit'); await expect(app).toHaveAttribute('data-tow-side', 'left');
});

test('police development reload, HMR and stage resets retain configuration and partial motorcycle travel', async ({ page }) => {
  const { gesture } = await import('./gesture.mjs');
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?dev=1&mission=police-patrol&stage=bikes&layout=3');
  const app = page.locator('#app'), { down, move, cancel, wait } = await fireControls(page);
  await wait('bikes'); await expect(app).toHaveAttribute('data-layout', '3');
  const h = await gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
  await down(h.from); await move(h.to);
  await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).bike0).toBeGreaterThan(0.1);
  await cancel(); const work = await app.getAttribute('data-work'); await page.reload(); await wait('bikes'); await expect(app).toHaveAttribute('data-work', work);
  const world = await page.locator('.world').elementHandle(), now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now); await page.waitForFunction(element => !element.isConnected, world);
  await wait('bikes'); await expect(app).toHaveAttribute('data-work', work); await expect(app).toHaveAttribute('data-layout', '3'); await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '重設目前階段' }).click(); await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).bike0).toBe(0);
  await page.locator('#stage').selectOption('door'); await wait('door'); await expect(app).toHaveAttribute('data-layout', '3');
  await page.locator('#layout').selectOption('1'); await wait('door'); await expect(app).toHaveAttribute('data-layout', '1');
  await page.getByRole('button', { name: '回到選關', exact: true }).click(); await page.getByRole('button', { name: '小小警察隊', exact: true }).click(); await wait('pursuit');
  await expect(app).toHaveAttribute('data-order', ''); await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '回到選關', exact: true }).click(); await page.getByRole('button', { name: '消防隊救火', exact: true }).click();
  await wait('dispatch'); await expect(app).toHaveAttribute('data-mission', 'fire-rescue'); expect(errors).toEqual([]);
});
