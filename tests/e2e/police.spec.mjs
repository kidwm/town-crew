import { test, expect } from '@playwright/test';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';

for (const layout of [0, 1]) {
  test(`police checkpoint layout ${layout} completes six gestures with persistent choice`, async ({ page }, info) => {
    const touch = info.project.name === 'tablet-touch', errors = [];
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(n => { Math.random = () => n; }, layout ? 0.75 : 0.25);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/#police-patrol');
    const app = page.locator('#app'), { down, move, up, cancel, wait } = await fireControls(page, touch);
    const hinted = async () => { const hint = page.locator('.drag-hint'); await expect(hint).toBeVisible(); return gesture(page, await hint.getAttribute('data-direction')); };
    async function start() { const h = await hinted(); await down(h.from); await move(h.to); }
    async function go(next) { await start(); await wait(next); await up(); }
    await expect(page.locator('.mission-steps [data-crew]')).toHaveCount(4);
    await wait('setup'); await expect(app).toHaveAttribute('data-layout', String(layout));
    await down({ x: 15, y: 150 }); await up(); await wait('setup');
    const h = await hinted(); await down(h.from); await up(); await wait('setup');
    await down(h.from); await move({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).setup).toBeGreaterThan(0.01);
    await cancel(); const partial = await app.getAttribute('data-work'); await page.reload(); await wait('setup'); await expect(app).toHaveAttribute('data-work', partial);
    await start(); await wait('bikes-arrival', 'working'); await up();
    await expect(page.locator('.drag-hint')).toBeHidden();
    await page.reload(); await wait('guard');
    await expect(page.locator('.police-choices [data-bike]:visible')).toHaveCount(2);
    await expect(page.locator('.police-target[data-goal="guard"]')).toHaveCount(1);
    const initialHint = await app.getAttribute('data-hint-vehicle');
    await expect(app).toHaveAttribute('data-hint-vehicle', initialHint === 'bike0' ? 'bike1' : 'bike0');
    // Directly choose a bike, independently of the hand's current demonstration.
    const selected = touch ? 'bike1' : 'bike0', guard = await hinted();
    const from = await page.locator(`.police-choices [data-bike="${selected}"]`).evaluate(node => {
      const rect = node.ownerSVGElement.getBoundingClientRect();
      return { x: rect.x + Number(node.dataset.gripX), y: rect.y + Number(node.dataset.gripY) };
    });
    await down(from); await expect(page.locator('.drag-hint')).toBeHidden();
    await expect(page.locator('.police-choices [data-bike]:visible')).toHaveCount(1);
    await move({ x: (from.x + guard.to.x) / 2, y: (from.y + guard.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).guard).toBeGreaterThan(0.1);
    await cancel(); await expect(app).toHaveAttribute('data-selected', selected);
    await page.reload(); await wait('guard'); await expect(app).toHaveAttribute('data-selected', selected);
    await start(); await expect(app).toHaveAttribute('data-phase', 'inspect');
    await expect(app).toHaveAttribute('data-checked', '0');
    await up();
    await expect(app).toHaveAttribute('data-checked', '1');
    await expect(app).toHaveAttribute('data-inspection', layout ? 'taxi' : 'freight');
    await page.reload(); await expect(app).toHaveAttribute('data-checked', '1');
    await expect(app).toHaveAttribute('data-checked', '2');
    await expect(app).toHaveAttribute('data-inspection', 'wanted');
    await page.locator('.police-check[data-matched="true"]').waitFor({ state: 'visible' });
    const checkBox = await page.locator('.police-check').boundingBox(), captionBox = await page.locator('.house-caption').boundingBox();
    expect(checkBox.y).toBeGreaterThanOrEqual(captionBox.y + captionBox.height + 8);
    await wait('van-arrival', 'working'); await expect(page.locator('.drag-hint')).toBeHidden();
    await page.reload(); await wait('van'); await expect(app).toHaveAttribute('data-action', 'ready'); await up();
    await go('door');
    const door = await hinted(), grip = { x: door.from.x, y: door.from.y + 44 };
    await down(grip); await expect(app).toHaveAttribute('data-action', 'dragging'); await up(); await wait('door');
    expect(JSON.parse(await app.getAttribute('data-work')).door).toBe(0);
    await down(grip); await move({ x: grip.x + (door.to.x - door.from.x) * 0.3, y: grip.y + (door.to.y - door.from.y) * 0.3 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).door).toBeGreaterThan(0.02);
    await cancel(); const doorWork = await app.getAttribute('data-work'); await page.reload(); await wait('door'); await expect(app).toHaveAttribute('data-work', doorWork);
    await start(); await expect(app).toHaveAttribute('data-phase', 'boarding'); await up();
    await page.reload(); await wait('transport'); await expect(app).toHaveAttribute('data-selected', selected);
    await go('tow');
    await expect(page.locator('[data-crew="van"]')).toHaveAttribute('data-state', 'done');
    const tow = await hinted(); await down(tow.from); await move({ x: (tow.from.x + tow.to.x) / 2, y: (tow.from.y + tow.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).recover).toBeGreaterThan(0.01);
    await cancel(); const recovery = await app.getAttribute('data-work'); await page.reload(); await wait('tow'); await expect(app).toHaveAttribute('data-work', recovery);
    await start(); await expect(app).toHaveAttribute('data-phase', 'tow-load'); await up();
    await expect(page.locator('[data-crew="tow"]')).toHaveAttribute('data-state', 'active');
    await page.reload(); await wait('complete');
    await expect(page.locator('[data-crew="tow"]')).toHaveAttribute('data-state', 'done');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator('.police-arrival')).toBeVisible(); await page.reload(); await wait('complete');
    await page.locator('.finish-home').click(); await expect(page.locator('.police-patrol .completed-mark')).toBeVisible();
    await page.getByRole('button', { name: '小小警察隊', exact: true }).click(); await wait('setup');
    await expect(app).toHaveAttribute('data-layout', String(1 - layout)); await expect(app).toHaveAttribute('data-selected', '');
    await expect(page.locator('canvas')).toHaveCount(1); expect(errors).toEqual([]);
  });
}
test('police rejects old pursuit and five-task snapshots and production ignores development stages', async ({ page }) => {
  await page.goto('/?dev=1&mission=police-patrol&stage=complete'); await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:police-patrol', JSON.stringify({ version: 1, phase: 'bikes', action: 'ready', round: { layout: 2, color: 3, body: 'van', bag: 1 }, elapsed: 0, active: null, aim: 0, work: { follow: 1, bike0: 0, bike1: 1, yield: 0, arrive: 0, door: 0, lead: 0, escort: 0 }, order: ['bike1'] })));
  await page.goto('/#police-patrol'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'setup'); await expect(page.locator('.dev-panel')).toHaveCount(0);
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:police-patrol', JSON.stringify({ version: 2, phase: 'guard', action: 'ready', round: { layout: 0, color: 3, body: 'van' }, elapsed: 0, active: null, aim: 0, work: { setup: 1, guard: 0.5, arrive: 0, door: 0, escort: 0 }, selected: 'bike1' })));
  await page.goto('/#police-patrol'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'setup');
});
