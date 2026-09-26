import { test, expect } from '@playwright/test';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';

for (const sample of [0.05, 0.3, 0.55, 0.8]) {
  test(`police collaboration layout ${Math.floor(sample * 4)} completes with persistent choices and transport`, async ({ page }, info) => {
    test.setTimeout(300_000);
    const touch = info.project.name === 'tablet-touch', errors = [];
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(n => { Math.random = () => n; }, sample);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await expect(page.locator('.mission-card')).toHaveCount(5);
    await page.getByRole('button', { name: '小小警察隊', exact: true }).click();
    const app = page.locator('#app'), { down, move: touchMove, up, cancel, wait } = await fireControls(page, touch);
    const move = p => touch ? touchMove(p) : page.mouse.move(p.x, p.y);
    await wait('pursuit'); await expect(app).toHaveAttribute('data-layout', String(Math.floor(sample * 4)));
    const layout = await app.getAttribute('data-layout'), body = await app.getAttribute('data-body'), color = await app.getAttribute('data-color');
    const hinted = async () => { const hint = page.locator('.drag-hint'); await expect(hint).toBeVisible(); return gesture(page, await hint.getAttribute('data-direction')); };
    async function startDrive() { const h = await hinted(); await down(h.from); await move(h.to); }
    async function go(next) { await startDrive(); await wait(next); await up(); }
    // Empty space and taps cannot drive. A cancelled partial drive resumes in place.
    await down({ x: 15, y: 150 }); await up(); await wait('pursuit');
    const h = await hinted(); await down(h.from); await up(); await wait('pursuit');
    await down(h.from); await move({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).follow).toBeGreaterThan(0.01);
    await cancel(); const partial = await app.getAttribute('data-work'); await page.reload(); await wait('pursuit');
    await expect(app).toHaveAttribute('data-work', partial); await expect(app).toHaveAttribute('data-layout', layout);
    await go('bikes');
    const first = touch ? 'bike1' : 'bike0';
    if (touch) {
      const secondBike = page.getByRole('button', { name: '先派二號重機' });
      await secondBike.click(); await expect(secondBike).toHaveAttribute('aria-pressed', 'true');
    }
    await startDrive(); await expect(app).toHaveAttribute('data-order', first); await wait('bikes');
    // Assistance consumes the old pointer; moving it over the other bike cannot dispatch it.
    const next = await hinted(); await move(next.from); await move(next.to); await page.waitForTimeout(500); await expect(app).toHaveAttribute('data-order', first); await up();
    await page.reload(); await wait('bikes'); await expect(app).toHaveAttribute('data-order', first);
    await page.screenshot({ path: info.outputPath('motorcycles.png') });
    await go('clearance'); await go('van'); await go('door');
    await page.screenshot({ path: info.outputPath('detective-van.png') });
    const door = await hinted();
    // The horizontal parking route exposes a lateral door gesture at the fixed town camera.
    expect(Math.abs(door.to.x - door.from.x)).toBeGreaterThan(Math.abs(door.to.y - door.from.y) * 2);
    await down(door.from); await move({ x: door.from.x + (door.to.x - door.from.x) * 0.3, y: door.from.y + (door.to.y - door.from.y) * 0.3 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).door).toBeGreaterThan(0.02);
    await cancel(); await wait('door'); const doorWork = await app.getAttribute('data-work');
    expect(JSON.parse(doorWork).door).toBeLessThan(1);
    await page.reload(); await wait('door'); await expect(app).toHaveAttribute('data-work', doorWork);
    await startDrive(); await expect(app).toHaveAttribute('data-phase', 'boarding'); await up();
    await page.reload(); await wait('lead'); await expect(app).toHaveAttribute('data-layout', layout); await expect(app).toHaveAttribute('data-body', body); await expect(app).toHaveAttribute('data-color', color);
    await go('transport'); await go('complete');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'); await expect(page.locator('.police-arrival')).toBeVisible();
    await page.screenshot({ path: info.outputPath('complete.png') });
    await page.reload(); await wait('complete'); await page.locator('.finish-home').click();
    await expect(page.locator('.police-patrol .completed-mark')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: '小小警察隊', exact: true }).click(); await wait('pursuit');
    expect(await app.getAttribute('data-layout')).not.toBe(layout); await expect(app).toHaveAttribute('data-order', '');
    const freshLayout = await app.getAttribute('data-layout'); await page.getByRole('button', { name: '重新開始警察任務' }).click(); await wait('pursuit');
    await expect(app).not.toHaveAttribute('data-layout', freshLayout); await wait('pursuit'); await expect(page.locator('canvas')).toHaveCount(1); expect(errors).toEqual([]);
  });
}

test('police rejects malformed saves and production ignores development stages', async ({ page }) => {
  await page.goto('/?dev=1&mission=police-patrol&stage=complete'); await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:police-patrol', '{"version":1,"phase":"complete","work":{}}'));
  await page.goto('/#police-patrol'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'pursuit'); await expect(page.locator('.dev-panel')).toHaveCount(0);
});
