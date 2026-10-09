import { test, expect } from '@playwright/test';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

const hinted = async page => gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
const centre = async locator => { await expect(locator).toBeVisible(); const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
for (const pattern of ['spread', 'cluster']) for (const layout of [0, 1]) {
  test(`mountain ${pattern}/${layout}: cooperate with four vehicles, retain work and reopen the mountain road`, async ({ page }, info) => {
    const touch = info.project.name === 'tablet-touch', errors = [];
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await page.addInitScript(({ pattern, layout }) => {
      if (!sessionStorage.getItem('town-crew:mountain:last-round:v1')) sessionStorage.setItem('town-crew:mountain:last-round:v1', JSON.stringify({ pattern: pattern === 'spread' ? 'cluster' : 'spread', layout }));
      Math.random = () => layout ? 0.8 : 0.2;
    }, { pattern, layout });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await expect(page.locator('.mission-card')).toHaveCount(7);
    await page.getByRole('button', { name: '山路搶通', exact: true }).click();
    const app = page.locator('#app'), { down, move, up, cancel, wait } = await fireControls(page, touch);
    const direct = p => touch ? move(p) : page.mouse.move(p.x, p.y);
    const startDrive = async () => { const h = await hinted(page); await down(h.from); await direct(h.to); };
    await wait('push'); await expect(app).toHaveAttribute('data-pattern', pattern); await expect(app).toHaveAttribute('data-layout', String(layout));
    await page.screenshot({ path: info.outputPath('mountain-push.png') });
    let h = await hinted(page); await down(h.from); await direct({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).pushes[0]).toBeGreaterThan(0.35);
    await page.screenshot({ path: info.outputPath('mountain-pushing.png') });
    await cancel(); const partial = await app.getAttribute('data-work'); await page.reload(); await wait('push'); await expect(app).toHaveAttribute('data-work', partial);
    await startDrive(); await expect(app).toHaveAttribute('data-motion', 'push-return'); await wait('push');
    await direct((await hinted(page)).to); await page.waitForTimeout(450);
    expect(JSON.parse(await app.getAttribute('data-work')).pushes[1]).toBe(0); await up();
    await startDrive(); await wait('excavate'); await up();
    await page.screenshot({ path: info.outputPath('mountain-excavate.png') });
    const order = touch ? [2, 0, 1] : [1, 2, 0];
    for (const [n, id] of order.entries()) {
      h = await hinted(page); await down(h.from); await direct(await centre(page.locator(`.mountain-goal[data-goal="${id}"]`)));
      await expect(app).toHaveAttribute('data-carried', String(id)); await wait('excavate');
      const bed = await centre(page.locator('.mountain-bed'));
      await direct(bed); await page.waitForTimeout(450); await expect(app).toHaveAttribute('data-delivered', order.slice(0, n).join(',')); await up();
      if (n === 0) {
        await page.reload(); await wait('excavate'); await expect(app).toHaveAttribute('data-carried', String(id));
        await withPausedClock(page, async () => { await down((await hinted(page)).from); await direct(await centre(page.locator('.mountain-bed'))); await page.clock.runFor(120); await cancel(); await page.clock.runFor(32); await expect(app).toHaveAttribute('data-delivered', ''); });
        await page.reload(); await wait('excavate'); await expect(app).toHaveAttribute('data-carried', String(id));
        await page.screenshot({ path: info.outputPath('mountain-carried.png') });
      }
      h = await hinted(page); await down(h.from); await direct(await centre(page.locator('.mountain-bed'))); await up();
      await expect(app).toHaveAttribute('data-delivered', order.slice(0, n + 1).join(','));
      if (n < 2) { await wait('excavate'); await page.reload(); await wait('excavate'); await expect(app).toHaveAttribute('data-delivered', order.slice(0, n + 1).join(',')); }
    }
    await wait('haul'); await page.screenshot({ path: info.outputPath('mountain-loaded-truck.png') });
    h = await hinted(page); await down(h.from); await direct({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).haul).toBeGreaterThan(0.05); await cancel();
    const hauled = await app.getAttribute('data-work'); await page.reload(); await wait('haul'); await expect(app).toHaveAttribute('data-work', hauled); await expect(app).toHaveAttribute('data-delivered', order.join(','));
    await startDrive(); await wait('sweep'); await up();
    h = await hinted(page); await down(h.from); await direct({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).swept).toBeGreaterThan(0.05); await cancel();
    const cleaned = await app.getAttribute('data-work'); await page.reload(); await wait('sweep'); await expect(app).toHaveAttribute('data-work', cleaned);
    await startDrive(); await wait('reopen', 'auto'); await up(); await page.reload(); await wait('complete', 'auto');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'); await page.screenshot({ path: info.outputPath('mountain-complete.png') });
    await page.reload(); await wait('complete', 'auto'); await page.locator('.finish-home').click();
    await expect(page.locator('.mountain-clearance .completed-mark')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: '山路搶通', exact: true }).click(); await wait('push'); await expect(app).toHaveAttribute('data-pattern', pattern === 'spread' ? 'cluster' : 'spread');
    await page.getByRole('button', { name: '重新開始山路搶通任務' }).click(); await wait('push'); await expect(app).toHaveAttribute('data-pattern', pattern); await expect(page.locator('canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
test('mountain ignores empty-space taps and rejects malformed snapshots and production stage shortcuts', async ({ page }, info) => {
  if (info.project.name === 'tablet-touch') await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?dev=1&mission=mountain-clearance&stage=complete'); await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:mountain-clearance', JSON.stringify({ version: 1, phase: 'complete', delivered: [] })));
  await page.goto('/#mountain-clearance'); const app = page.locator('#app'); await expect(app).toHaveAttribute('data-phase', 'push');
  await page.mouse.click(195, 160); await expect(app).toHaveAttribute('data-action', 'ready'); expect(JSON.parse(await app.getAttribute('data-work')).pushes).toEqual([0, 0]);
  const h = await hinted(page); await page.mouse.click(h.from.x, h.from.y); await expect(app).toHaveAttribute('data-action', 'ready'); expect(JSON.parse(await app.getAttribute('data-work')).pushes).toEqual([0, 0]);
  await expect(page.locator('.dev-panel')).toHaveCount(0);
});
