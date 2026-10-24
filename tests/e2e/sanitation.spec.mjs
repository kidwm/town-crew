import { test, expect } from '@playwright/test';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

for (const layout of [0, 1]) test(`sanitation layout ${layout}: four trucks, two real bin lifts and cleanup`, async ({ page }, info) => {
  test.setTimeout(200_000);
  const touch = info.project.name === 'tablet-touch', errors = [];
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install(); await page.addInitScript(n => { Math.random = () => n; }, layout ? 0.8 : 0.1);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('.mission-card')).toHaveCount(9);
  await page.getByRole('button', { name: '垃圾車清潔隊', exact: true }).click();
  const app = page.locator('#app'), { down, move: touchMove, up, cancel, wait } = await fireControls(page, touch);
  const move = p => touch ? touchMove(p) : page.mouse.move(p.x, p.y);
  const hinted = async () => gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
  const source = async id => { const r = await page.locator(`.sanitation-source[data-item="${id}"]`).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const start = async id => { const h = await hinted(); await down(id ? await source(id) : h.from); await move(h.to); return h; };
  const go = async (next, action = 'ready') => { await start(); await wait(next, action); await up(); };
  await wait('garbage-arrival'); await expect(app).toHaveAttribute('data-layout', String(layout));
  // A tap cannot drive. Partly driven vehicles retain their position through cancellation/reload.
  let h = await hinted(); await down(h.from); await up(); await expect(app).toHaveAttribute('data-travel', '0');
  await down(h.from); await move({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
  await expect.poll(async () => Number(await app.getAttribute('data-travel'))).toBeGreaterThan(0.05); await cancel();
  const partial = await app.getAttribute('data-travel'); await page.reload(); await wait('garbage-arrival'); await expect(app).toHaveAttribute('data-travel', partial);
  await go('bags'); await page.screenshot({ path: info.outputPath('garbage-parked.png') });
  const bagOrder = touch === Boolean(layout) ? ['bag-0', 'bag-1'] : ['bag-1', 'bag-0'];
  await withPausedClock(page, async () => { await start(bagOrder[0]); await page.clock.runFor(120); await cancel(); await page.clock.runFor(32); });
  await wait('bags'); await expect(app).toHaveAttribute('data-bags', ''); await page.reload(); await wait('bags');
  for (let i = 0; i < 2; i++) {
    await start(bagOrder[i]); await wait('bag-loading', 'auto'); await up(); await wait(i ? 'bin-dock' : 'bags');
  }
  await expect(app).toHaveAttribute('data-bags', bagOrder.join(','));
  await start('bin'); await wait('bin-lift');
  // A still-held finger after docking cannot begin the separate lift.
  h = await hinted(); await move(h.from); await move(h.to); await expect(app).toHaveAttribute('data-travel', '0'); await up();
  h = await hinted(); await down(h.from); await move({ x: h.from.x, y: h.from.y + (h.to.y - h.from.y) * 0.45 }); await cancel();
  const lift = await app.getAttribute('data-travel'); expect(Number(lift)).toBeGreaterThan(0.35); expect(Number(lift)).toBeLessThan(0.55);
  await page.reload(); await wait('bin-lift'); await expect(app).toHaveAttribute('data-travel', lift); await page.screenshot({ path: info.outputPath('bin-partly-raised.png') });
  await start('bin'); await wait('bin-tip', 'auto');
  await expect.poll(async () => Number(await app.getAttribute('data-elapsed'))).toBeGreaterThan(0.7);
  await page.screenshot({ path: info.outputPath('bin-tipping.png') }); await page.reload(); await wait('garbage-exit'); await up(); await expect(app).toHaveAttribute('data-bin-empty', 'true');
  await go('recycle-arrival'); await go('recycling');
  const recycling = touch === Boolean(layout) ? ['bottles', 'cardboard'] : ['cardboard', 'bottles'];
  for (let i = 0; i < 2; i++) { await start(recycling[i]); await wait('recycle-loading', 'auto'); await up(); await wait(i ? 'recycle-exit' : 'recycling'); }
  await expect(app).toHaveAttribute('data-recycled', recycling.join(',')); await page.screenshot({ path: info.outputPath('recycling-loaded.png') });
  await page.reload(); await wait('recycle-exit'); await expect(app).toHaveAttribute('data-recycled', recycling.join(','));
  await go('food-arrival'); await go('food-dock'); await start('food'); await wait('food-lift'); await up();
  await page.screenshot({ path: info.outputPath('food-truck.png') });
  await start('food'); await wait('food-tip', 'auto'); await up(); await expect.poll(async () => Number(await app.getAttribute('data-elapsed'))).toBeGreaterThan(0.7); await page.screenshot({ path: info.outputPath('food-tipping.png') });
  await wait('food-exit'); await expect(app).toHaveAttribute('data-food-empty', 'true'); await go('sweep');
  h = await hinted(); await down(h.from); await move({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
  await expect.poll(async () => Number(await app.getAttribute('data-swept'))).toBeGreaterThan(0.1); await cancel(); const swept = await app.getAttribute('data-swept');
  await page.reload(); await wait('sweep'); await expect(app).toHaveAttribute('data-swept', swept); await page.screenshot({ path: info.outputPath('sweeper.png') });
  await go('complete'); await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'); await expect(page.locator('[data-step][data-state="done"]')).toHaveCount(4);
  await page.screenshot({ path: info.outputPath('complete.png') }); await page.reload(); await wait('complete');
  await page.locator('.finish-home').click(); await expect(page.locator('.sanitation .completed-mark')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '垃圾車清潔隊', exact: true }).click(); await wait('garbage-arrival'); await expect(app).not.toHaveAttribute('data-layout', String(layout));
  await expect(app).toHaveAttribute('data-bags', ''); await expect(app).toHaveAttribute('data-food-empty', 'false');
  const fresh = await app.getAttribute('data-layout'); await page.getByRole('button', { name: '重新開始清潔隊任務' }).click(); await wait('garbage-arrival'); await expect(app).not.toHaveAttribute('data-layout', fresh);
  await expect(page.locator('canvas')).toHaveCount(1); expect(errors).toEqual([]);
});
test('sanitation production ignores stage shortcuts and rejects incomplete completion', async ({ page }) => {
  await page.goto('/?dev=1&mission=sanitation&stage=complete'); await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:sanitation', '{"version":1,"phase":"complete","foodEmpty":false}'));
  await page.goto('/#sanitation'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'garbage-arrival'); await expect(page.locator('.dev-panel')).toHaveCount(0);
});
