import { test, expect } from '@playwright/test';

// Registered narrated missions must pass the offline asset gate before browser CI.
const missions = ['road-repair'];
for (const mission of missions) test(`${mission}: narration replays, shares mute, and releases on navigation`, async ({ page }, info) => {
  if (info.project.use.hasTouch) await page.setViewportSize({ width: 390, height: 844 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    window.__voiceMedia = [];
    window.Audio = function (...args) { const media = new NativeAudio(...args); window.__voiceMedia.push(media); return media; };
  });
  await page.goto(`/#${mission}`);
  const replay = page.getByRole('button', { name: '再聽一次提示' });
  await replay.click(); await expect(replay).toHaveAttribute('data-status', 'playing');
  expect(await page.evaluate(() => window.__voiceMedia.length)).toBe(1);
  await page.getByRole('button', { name: '關閉音效', exact: true }).click();
  await expect(replay).toHaveAttribute('data-status', 'muted');
  expect(await page.evaluate(() => window.__voiceMedia.every(media => media.paused))).toBe(true);
  // Wait for the first operation; muting during an intro discards that announcement.
  await expect(page.locator('#app')).not.toHaveAttribute('data-phase', /^(intro|collision)$/);
  await replay.click(); await expect(replay).toHaveAttribute('data-status', 'playing');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await expect(page.locator('.mission-card')).toHaveCount(10);
  expect(await page.evaluate(() => window.__voiceMedia.every(media => media.paused && !media.getAttribute('src')))).toBe(true);
  expect(errors).toEqual([]);
});
