import { test, expect } from '@playwright/test';
import { utimes } from 'node:fs/promises';
import { fireControls } from './fire-controls.mjs';

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
  await page.getByRole('button', { name: '重設目前階段' }).click();
  await expect(app).toHaveAttribute('data-action', 'opening-entry');
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
