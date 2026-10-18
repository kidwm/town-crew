import { test, expect } from '@playwright/test';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

for (const layout of [0, 1]) {
  test(`passenger transfer layout ${layout} completes with real doors, independent dispatch and luggage`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const touch = info.project.name === 'tablet-touch', errors = [];
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install(); await page.addInitScript(n => { Math.random = () => n; }, layout ? 0.8 : 0.1);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await expect(page.locator('.mission-card')).toHaveCount(8);
    await page.getByRole('button', { name: '乘客轉運站', exact: true }).click();
    const app = page.locator('#app'), { down, move: touchMove, up, cancel, wait } = await fireControls(page, touch);
    const move = p => touch ? touchMove(p) : page.mouse.move(p.x, p.y);
    const hinted = async () => { await expect(page.locator('.drag-hint')).toBeVisible(); return gesture(page, await page.locator('.drag-hint').getAttribute('data-direction')); };
    const start = async () => { const h = await hinted(); await down(h.from); await move(h.to); };
    const go = async (next, action = 'ready') => { await start(); await wait(next, action); await up(); };
    const companion = layout ? 'coach' : 'school', final = layout ? 'school' : 'coach';
    const loadCoach = async exitPhase => {
      await page.screenshot({ path: info.outputPath('coach-luggage-bay.png') });
      await withPausedClock(page, async () => {
        h = await hinted(); await down(h.from); await move(h.to); await page.clock.runFor(120); await cancel(); await page.clock.runFor(32);
      });
      await wait('luggage'); const bag = await app.getAttribute('data-luggage'); await page.reload(); await wait('luggage'); await expect(app).toHaveAttribute('data-luggage', bag);
      h = await hinted(); await down(h.from); await move({ x: h.from.x + 45, y: h.from.y + 55 }); await move(h.to);
      await wait('loading', 'auto'); await page.reload(); await wait(exitPhase); await up();
      await page.screenshot({ path: info.outputPath('coach-ready.png') });
    };
    await wait('bus-arrival'); await expect(app).toHaveAttribute('data-layout', String(layout));
    // Empty space and a tap cannot move the bus. Cancellation/reload preserves partial driving.
    await down({ x: 12, y: 160 }); await up(); await expect(app).toHaveAttribute('data-travel', '0');
    let h = await hinted(); await down(h.from); await up(); await expect(app).toHaveAttribute('data-travel', '0');
    await down(h.from); await move({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
    await expect.poll(async () => Number(await app.getAttribute('data-travel'))).toBeGreaterThan(0.03);
    await cancel(); const partial = await app.getAttribute('data-travel'); await page.reload(); await wait('bus-arrival'); await expect(app).toHaveAttribute('data-travel', partial);
    await go('bus-door'); await page.screenshot({ path: info.outputPath('bus-at-platform.png') });
    h = await hinted(); const beside = { x: h.from.x, y: h.from.y + 42 };
    await down(beside); await move({ x: beside.x + (h.to.x - h.from.x) * 0.35, y: beside.y + (h.to.y - h.from.y) * 0.35 });
    await cancel(); const doors = await app.getAttribute('data-doors'); expect(JSON.parse(doors).bus).toBeGreaterThan(0.1);
    await page.reload(); await wait('bus-door'); await expect(app).toHaveAttribute('data-doors', doors);
    await start(); await wait('unloading', 'auto');
    await expect.poll(async () => Number(await app.getAttribute('data-elapsed'))).toBeGreaterThan(2);
    await page.screenshot({ path: info.outputPath('passengers-alighting.png') }); await wait('bus-exit');
    // An old, still-held finger cannot drive after automatic alighting.
    h = await hinted(); await move(h.from); await move(h.to); await expect(app).toHaveAttribute('data-travel', '0'); await up();
    await go('transfer-entrance', 'auto');
    await page.screenshot({ path: info.outputPath('transfer-vehicles-entering.png') });
    await wait('choose'); await page.screenshot({ path: info.outputPath('waiting-passengers.png') });
    await expect(page.locator('.transfer-choice-ring:not([hidden])')).toHaveCount(2);
    await expect(page.locator('.transfer-picker button:not([hidden])[aria-pressed="false"]')).toHaveCount(2);
    await expect(page.locator('[data-step="taxi"]')).toHaveAttribute('data-state', 'active');
    await expect(page.locator(`[data-step="${companion}"]`)).toHaveAttribute('data-state', 'active');
    await expect(app).toHaveAttribute('data-companion', companion);
    await expect(page.locator('.drag-hint')).toBeHidden();
    const first = Boolean(layout) === touch ? 'taxi' : companion, order = [first, first === 'taxi' ? companion : 'taxi'];
    await page.getByRole('button', { name: first === 'taxi' ? '先派計程車' : first === 'school' ? '先派校車' : '先派遊覽車', exact: true }).click();
    await expect(page.locator('.transfer-goal')).toHaveText(first === 'taxi' ? '計程車載客區' : '大型車停靠區');
    await expect(page.locator('.transfer-choice-ring:not([hidden])')).toHaveCount(2);
    for (let n = 0; n < order.length; n++) {
      await go('transfer-door'); await expect(app).toHaveAttribute('data-vehicle', order[n]);
      await start();
      if (order[n] === 'coach') { await wait('luggage'); await up(); await loadCoach('transfer-exit'); }
      else {
        await wait('boarding', 'auto');
        await expect.poll(async () => Number(await app.getAttribute('data-elapsed'))).toBeGreaterThan(1.4);
        await page.screenshot({ path: info.outputPath(`${order[n]}-boarding.png`) });
        await wait('transfer-exit'); await up();
      }
      await go(n ? 'coach-entrance' : 'choose', n ? 'auto' : 'ready');
      if (n) {
        await expect(page.locator('.drag-hint')).toBeHidden();
        await expect(page.locator('.transfer-goal')).toBeHidden();
        await page.screenshot({ path: info.outputPath('coach-entering.png') });
        await wait('coach-arrival');
      }
      await expect(app).toHaveAttribute('data-order', order.slice(0, n + 1).join(','));
      await page.reload(); await wait(n ? 'coach-arrival' : 'choose'); await expect(app).toHaveAttribute('data-order', order.slice(0, n + 1).join(','));
    }
    await go('coach-door'); await expect(app).toHaveAttribute('data-vehicle', final);
    if (final === 'coach') { await go('luggage'); await loadCoach('coach-exit'); }
    else await go('coach-exit');
    await go('complete'); await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'); await expect(page.locator('.transfer-finish')).toBeVisible();
    await page.screenshot({ path: info.outputPath('complete.png') }); await page.reload(); await wait('complete');
    await page.locator('.finish-home').click(); await expect(page.locator('.passenger-transfer .completed-mark')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: '乘客轉運站', exact: true }).click(); await wait('bus-arrival'); await expect(app).not.toHaveAttribute('data-layout', String(layout));
    await expect(app).toHaveAttribute('data-order', ''); const fresh = await app.getAttribute('data-layout'); await page.getByRole('button', { name: '重新開始轉運站任務' }).click(); await wait('bus-arrival'); await expect(app).not.toHaveAttribute('data-layout', fresh);
    await expect(page.locator('canvas')).toHaveCount(1); expect(errors).toEqual([]);
  });
}
test('transfer ignores production stage shortcuts and rejects contradictory completion saves', async ({ page }) => {
  await page.goto('/?dev=1&mission=passenger-transfer&stage=complete'); await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:passenger-transfer', '{"version":1,"phase":"complete","order":[]}'));
  await page.goto('/#passenger-transfer'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'bus-arrival'); await expect(page.locator('.dev-panel')).toHaveCount(0);
});
