import { test, expect } from '@playwright/test';
import { FIRES } from '../../src/missions/fire-rescue/domain/fire.ts';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

test('fire brigade extinguishes, rescues both floors in either order, and transports the resident', async ({ page }, info) => {
  const touch = info.project.name === 'tablet-touch', errors = [];
  // The touch run exercises the narrower portrait layout for the entire mission.
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.mission-card')).toHaveCount(3);
  await page.getByRole('button', { name: '消防隊救火', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('menu-fire.png') });
  await page.getByRole('button', { name: '消防隊救火', exact: true }).click();
  const app = page.locator('#app'), { down, move, up, cancel, wait, project, target, dragGoal } = await fireControls(page, touch);
  await wait('dispatch');
  await page.getByRole('button', { name: '關閉音效', exact: true }).click();
  const driving = await gesture(page, 'right');
  await down(driving.from); await move(driving.to); await wait('hose'); await up();
  await page.screenshot({ path: info.outputPath('hose.png') });
  const hose = await gesture(page, 'up');
  await withPausedClock(page, async () => {
    await down(hose.from); await move(hose.to); await page.clock.runFor(120); await cancel();
  });
  await wait('hose');
  await expect(app).toHaveAttribute('data-extinguished', '0');
  await dragGoal('hydrant'); await wait('ground-fire'); await up();
  // Partial water is retained on cancellation and reload. The next flame never
  // extinguishes just because a held finger remains on a finished flame.
  const flame = i => project({ ...FIRES[i], y: FIRES[i].y + 0.4 });
  await down(await flame(0));
  await expect(app).toHaveAttribute('data-action', 'dragging');
  await page.waitForTimeout(350); await cancel(); await wait('ground-fire');
  await page.reload(); await wait('ground-fire');
  await expect(page.getByRole('button', { name: '開啟音效', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < 3; i++) {
    // Move the same held finger from the second fire to the third one.
    if (i === 2) await move(await flame(i)); else await down(await flame(i));
    if (i === 1) await page.screenshot({ path: info.outputPath('spraying.png') });
    await expect(app).toHaveAttribute('data-extinguished', String(i + 1));
    if (i === 0) { await page.waitForTimeout(350); await expect(app).toHaveAttribute('data-extinguished', '1'); }
    if (i !== 1) await up();
  }
  await wait('roof-reach'); await dragGoal('roof'); await wait('roof-fire'); await up();
  await page.screenshot({ path: info.outputPath('roof-basket.png') });
  await down(await flame(3)); await wait('rescue'); await up();
  await expect(app).toHaveAttribute('data-extinguished', '4');
  const order = touch ? ['cat', 'resident'] : ['resident', 'cat'];
  await page.screenshot({ path: info.outputPath('rescue-choice.png') });
  for (let i = 0; i < 2; i++) {
    await dragGoal(order[i]);
    await expect(app).toHaveAttribute('data-passenger', order[i]);
    await wait('rescue', 'returning');
    await page.screenshot({ path: info.outputPath(`lowering-${order[i]}.png`) });
    await expect(app).toHaveAttribute('data-rescued', String(i + 1));
    if (i === 0) {
      await wait('rescue');
      // Automatic assistance owns the whole trip. A still-held finger cannot
      // pick up the second passenger, even after the basket is ready again.
      await move(await target(order[1])); await page.waitForTimeout(650);
      await expect(app).toHaveAttribute('data-action', 'ready');
      await expect(app).toHaveAttribute('data-rescued', '1');
      await up(); await page.reload(); await wait('rescue');
      await expect(app).toHaveAttribute(`data-${order[0]}`, 'true');
      await expect(page.locator('.fire-target')).toHaveCount(1);
    } else await up();
  }
  await wait('ambulance');
  const parking = await gesture(page, 'right');
  await down(parking.from); await move(parking.to); await wait('stretcher'); await up();
  await page.screenshot({ path: info.outputPath('stretcher.png') });
  await dragGoal('patient'); await wait('boarding'); await up();
  await page.screenshot({ path: info.outputPath('boarding.png') });
  await dragGoal('ambulance', 'right'); await wait('complete'); await up();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('.hospital-arrival')).toBeVisible();
  await page.screenshot({ path: info.outputPath('complete.png') });
  await page.reload(); await wait('complete');
  await page.locator('.finish-home').click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.fire-rescue .completed-mark')).toBeVisible();
  await page.getByRole('button', { name: '消防隊救火', exact: true }).click(); await wait('dispatch');
  await expect(app).toHaveAttribute('data-extinguished', '0'); await expect(app).toHaveAttribute('data-rescued', '0');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: '重新開始消防救援任務' }).click(); await wait('dispatch');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('production rejects a contradictory fire snapshot and ignores developer shortcuts', async ({ page }) => {
  await page.goto('/?dev=1&mission=fire-rescue&stage=complete');
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:fire-rescue', JSON.stringify({ version: 1, phase: 'complete' })));
  await page.goto('/#fire-rescue');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'dispatch');
  await expect(page.locator('.dev-panel')).toHaveCount(0);
});
