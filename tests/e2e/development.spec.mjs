import { test, expect } from '@playwright/test';
import { utimes } from 'node:fs/promises';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

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

test('house development stages, reload and HMR preserve the second floor', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?dev=1&mission=house-build&stage=crane-two');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-phase', 'crane-two');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await expect(app).toHaveAttribute('data-placed', '3');
  await page.reload();
  await expect(app).toHaveAttribute('data-placed', '3');
  const world = await page.locator('.world').elementHandle();
  const now = new Date();
  await utimes(new URL('../../src/main.ts', import.meta.url), now, now);
  await page.waitForFunction(element => !element.isConnected, world);
  await expect(app).toHaveAttribute('data-placed', '3');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.locator('#stage').selectOption('concrete');
  await expect(app).toHaveAttribute('data-pours', '0');
  await expect(app).toHaveAttribute('data-placed', '0');
  await expect(app).toHaveAttribute('data-action', 'ready');
  await page.getByRole('button', { name: '重設目前階段' }).click();
  await expect(app).toHaveAttribute('data-action', 'entering');
  await expect(app).toHaveAttribute('data-action', 'ready');
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
