import { test, expect } from '@playwright/test';
import { utimes } from 'node:fs/promises';

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
