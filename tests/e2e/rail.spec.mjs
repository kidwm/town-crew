import { test, expect } from '@playwright/test';
import { createRail, directions, origins, destinations } from '../../src/missions/rail-transfer/domain/rail.ts';
import { fireControls } from './fire-controls.mjs';
import { gesture } from './gesture.mjs';

for (const direction of directions) for (const layout of [0, 1]) {
  test(`rail ${direction}/${layout}: independent dispatch, doors, transfer, reload and replay`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const touch = info.project.name === 'tablet-touch';
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const snapshot = createRail('intro', { direction, layout, palette: 2, cast: 1 });
    await page.addInitScript(value => { if (!sessionStorage.getItem('town-crew:play:v1:rail-transfer')) sessionStorage.setItem('town-crew:play:v1:rail-transfer', JSON.stringify(value)); }, snapshot);
    await page.goto('/#rail-transfer');
    const app = page.locator('#app'), { down, move, up, cancel, wait } = await fireControls(page, touch);
    const hinted = async () => gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
    const run = async () => { const h = await hinted(); await down(h.from); await move(h.to); await up(); };
    await wait('choose'); await expect(page.locator('.rail-choice-ring:not([hidden])')).toHaveCount(2);
    const source = origins({ direction });
    const destination = destinations({ direction });
    const order = [source[layout], source[1 - layout], destination[1 - layout], destination[layout]];
    for (let visit = 0; visit < 4; visit++) {
      await wait('choose');
      const ring = page.locator(`[data-choice="${order[visit]}"]`);
      const from = await ring.evaluate(el => { const r = el.parentElement.getBoundingClientRect(); return { x: r.x + Number(el.dataset.x), y: r.y + Number(el.dataset.y) }; });
      // Both real train bodies remain available even when the other hand is demonstrating.
      await down(from); await up(); await wait('choose');
      await down(from); await expect(app).toHaveAttribute('data-vehicle', order[visit]);
      // During a held gesture the demonstration is hidden; read the visible destination.
      const goal = await page.locator('.rail-goal').boundingBox();
      await move({ x: goal.x + goal.width / 2, y: goal.y + goal.height / 2 }); await up();
      await wait('door'); await expect(app).toHaveAttribute('data-vehicle', order[visit]);
      if (visit === 0) {
        const door = await hinted(); await down(door.from); await move({ x: door.from.x + (door.to.x - door.from.x) * 0.4, y: door.from.y }); await cancel();
        const partial = await app.getAttribute('data-door'); expect(Number(partial)).toBeGreaterThan(0.1);
        await page.reload(); await wait('door'); await expect(app).toHaveAttribute('data-door', partial);
      }
      await run(); await wait('passengers');
      await page.screenshot({ path: info.outputPath(`rail-${visit}-passengers.png`) });
      if (visit === 1) { await page.reload(); await wait('passengers'); }
      await wait('exit'); await run();
      if (visit === 3) await wait('complete');
      else await wait('choose');
      await expect(app).toHaveAttribute('data-order', order.slice(0, visit + 1).join(','));
    }
    await page.getByRole('button', { name: '回到選關', exact: true }).last().click();
    await expect(page.locator('.mission-card')).toHaveCount(10);
    await expect(page.locator('.rail-transfer .completed-mark')).toBeVisible();
    await page.getByRole('button', { name: '列車轉乘', exact: true }).click();
    await wait('choose'); await expect(app).not.toHaveAttribute('data-direction', direction);
    await expect(app).toHaveAttribute('data-order', ''); expect(errors).toEqual([]);
  });
}

test('rail reduced motion keeps both trains selectable and uses a stationary hand', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(value => sessionStorage.setItem('town-crew:play:v1:rail-transfer', JSON.stringify(value)), createRail('choose'));
  await page.goto('/#rail-transfer');
  const { down, move, up, wait } = await fireControls(page); await wait('choose');
  await expect(page.locator('.rail-choice-ring:not([hidden])')).toHaveCount(2);
  const hand = page.locator('.drag-hint-hand'), initial = await hand.getAttribute('transform');
  await page.waitForTimeout(2600); await expect(hand).toHaveAttribute('transform', initial);
  const ring = page.locator('[data-choice="regional"]'), from = await ring.evaluate(el => ({ x: Number(el.dataset.x), y: Number(el.dataset.y) }));
  await down(from); await expect(page.locator('#app')).toHaveAttribute('data-vehicle', 'regional');
  const goal = await page.locator('.rail-goal').boundingBox(); await move({ x: goal.x + goal.width / 2, y: goal.y + goal.height / 2 }); await up(); await wait('door');
});

for (const travel of [0.75, 0.99, 1]) test(`rail interrupted tram departure at ${travel} can resume after reload`, async ({ page }, info) => {
  if (info.project.name === 'tablet-touch') await page.setViewportSize({ width: 390, height: 844 });
  const snapshot = { ...createRail('exit', { direction: 'city', layout: 0, palette: 0, cast: 0 }, 3), travel, aim: travel };
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('town-crew:play:v1:rail-transfer')) sessionStorage.setItem('town-crew:play:v1:rail-transfer', JSON.stringify(value));
  }, snapshot);
  await page.goto('/#rail-transfer');
  const { down, move, up, wait } = await fireControls(page, info.project.name === 'tablet-touch');
  await wait('exit'); await page.reload(); await wait('exit');
  const points = await page.locator('.rail-source').evaluate(el => {
    const a = el.getBoundingClientRect(), b = document.querySelector('.rail-goal').getBoundingClientRect();
    return { from: { x: a.x + a.width / 2, y: a.y + a.height / 2 }, to: { x: b.x + b.width / 2, y: b.y + b.height / 2 } };
  });
  await down(points.from);
  if (travel < 1) await move({ x: points.to.x + Math.sign(points.to.x - points.from.x), y: points.to.y });
  await up(); await wait('complete');
});
