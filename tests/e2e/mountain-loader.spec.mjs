import { test, expect } from '@playwright/test';
import { createMountain } from '../../src/missions/mountain-clearance/domain/mountain.ts';
import { loaderRoute, routeLength, PARK_SECONDS } from '../../src/missions/mountain-clearance/domain/loader.ts';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

// Resume an ordinary production snapshot at the handoff so every configuration
// can exercise the new tool, without replaying the unchanged bulldozer each time.
for (const pattern of ['spread', 'cluster']) for (const layout of [0, 1]) {
  test(`loader ${pattern}/${layout}: continuous choice, visible scoop/pour and saved soil`, async ({ page }, info) => {
    const touch = info.project.name === 'tablet-touch', id = touch ? 1 - layout : layout;
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await page.addInitScript(state => { if (!sessionStorage.getItem('town-crew:play:v1:mountain-clearance')) sessionStorage.setItem('town-crew:play:v1:mountain-clearance', JSON.stringify(state)); }, createMountain('load-soil', { pattern, layout }));
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/#mountain-clearance');
    const app = page.locator('#app'), { wait, down, move, up } = await fireControls(page, touch);
    const direct = p => touch ? move(p) : page.mouse.move(p.x, p.y);
    const hinted = async () => gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
    const centre = async selector => { const r = await page.locator(selector).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    await wait('load-soil'); await expect(page.locator('[data-goal^="soil-"]')).toHaveCount(2);
    for (const [n, selected] of [id, 1 - id].entries()) {
      const soilLoaded = n ? [id] : [];
      await withPausedClock(page, async () => {
        const h = await hinted(), pile = await centre(`[data-goal="soil-${selected}"]`);
        await down(h.from);
        for (let i = 1; i <= 12; i++) { await direct({ x: h.from.x + (pile.x - h.from.x) * i / 12, y: h.from.y + (pile.y - h.from.y) * i / 12 }); await page.clock.runFor(16); }
        await up(); await expect(app).toHaveAttribute('data-loader-selected', String(selected));
        const route = loaderRoute({ ...createMountain('load-soil'), soilLoaded, loaderSelected: selected });
        await page.clock.runFor(Math.ceil(routeLength(route) / 4.8 * 1000) + 80);
        await expect(app).toHaveAttribute('data-motion', 'loader-scoop');
        await page.clock.runFor(450); await page.screenshot({ path: info.outputPath(`loader-scooping-${n}.png`) });
      });
      await wait('load-soil'); await expect(app).toHaveAttribute('data-loader-carrying', 'true');
      if (n === 0) {
        await page.reload(); await wait('load-soil'); await expect(app).toHaveAttribute('data-loader-selected', String(selected)); await expect(app).toHaveAttribute('data-loader-carrying', 'true');
      }
      await withPausedClock(page, async () => {
        const carrying = await hinted(); await down(carrying.from); await direct(await centre('.mountain-dock'));
        const route = loaderRoute({ ...createMountain('load-soil'), soilLoaded, loaderSelected: selected, loaderCarrying: true });
        await page.clock.runFor(Math.ceil(routeLength(route) / 4.8 * 1000) + PARK_SECONDS * 1000 + 600);
        await expect(app).toHaveAttribute('data-loader-docked', 'true'); await expect(app).toHaveAttribute('data-action', 'ready');
        // The same held finger cannot turn driving into raising.
        const lift = await hinted(); await direct(lift.to); await page.clock.runFor(700);
        await expect(app).toHaveAttribute('data-loader-travel', '0'); await expect(app).toHaveAttribute('data-soil-loaded', soilLoaded.join(',')); await up();
        await page.screenshot({ path: info.outputPath(`loader-parked-${n}.png`) });
      });
      if (n === 0) { await page.reload(); await wait('load-soil'); await expect(app).toHaveAttribute('data-loader-docked', 'true'); }
      await withPausedClock(page, async () => {
        const lift = await hinted(); await expect(page.locator('.drag-hint')).toHaveAttribute('data-direction', 'up');
        await down(lift.from); await direct(lift.to); await up(); await page.clock.runFor(1280);
        await expect(app).toHaveAttribute('data-motion', 'loader-tip');
        await page.clock.runFor(1350); await page.screenshot({ path: info.outputPath(`loader-pouring-${n}.png`) });
      });
      if (n === 0) await page.reload();
      await expect(app).toHaveAttribute('data-soil-loaded', [id, 1 - id].slice(0, n + 1).join(','));
      if (n === 0) {
        await wait('load-soil'); await expect(page.locator('[data-goal^="soil-"]')).toHaveCount(1);
        await expect(page.locator(`[data-goal="soil-${1 - id}"]`)).toBeVisible(); await expect(app).toHaveAttribute('data-loader-carrying', 'false');
      }
    }
    await wait('haul'); await expect(app).toHaveAttribute('data-delivered', '0,1,2');
    await page.screenshot({ path: info.outputPath('loader-filled-gaps.png') });
    expect(errors).toEqual([]);
  });
}
