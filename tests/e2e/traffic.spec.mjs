import { test, expect } from '@playwright/test';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

test('traffic crew controls the scene, tows both colours, sweeps and transports on mouse and phone touch', async ({ page }, info) => {
  test.setTimeout(300_000);
  const touch = info.project.name === 'tablet-touch', errors = [];
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  // Exercise opposite random assignments as well as opposite child choices.
  await page.addInitScript(sample => { Math.random = () => sample; }, touch ? 0.75 : 0.25);
  page.on('pageerror', e => errors.push(e.message)); await page.clock.install();
  await page.goto('/'); await expect(page.locator('.mission-card')).toHaveCount(5);
  await page.getByRole('button', { name: '交通救援隊', exact: true }).click();
  const app = page.locator('#app'), { down, move, up, cancel, wait } = await fireControls(page, touch);
  async function hinted() { const hint = page.locator('.drag-hint'); await expect(hint).toBeVisible(); return gesture(page, await hint.getAttribute('data-direction')); }
  async function go() { const h = await hinted(); await down(h.from); await move(h.to); }
  async function target(id) { const r = await page.locator(`.traffic-target[data-goal="${id}"]`).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
  async function place(id) { const h = await hinted(); await down(h.from); const to = await target(id); if (touch) await move(to); else await page.mouse.move(to.x, to.y); }
  await wait('police'); const colors = await app.getAttribute('data-colors'); expect(new Set(colors.split(',')).size).toBe(2);
  await page.screenshot({ path: info.outputPath('police.png') });
  await page.getByRole('button', { name: '關閉音效', exact: true }).click();
  await go(); await wait('cones'); await up();
  await withPausedClock(page, async () => { await place('cone-left'); await page.clock.runFor(120); await cancel(); });
  await wait('cones'); await expect(page.locator('.traffic-target')).toHaveCount(2);
  await place('cone-left'); await wait('cones');
  // The original held pointer cannot place the second cone after assistance.
  await move(await target('cone-right')); await page.waitForTimeout(450); await expect(page.locator('.traffic-target')).toHaveCount(1); await up();
  await place('cone-right'); await wait('tow-choice'); await up();
  await page.screenshot({ path: info.outputPath('tow-choice.png') });
  const types = await app.getAttribute('data-tow-types');
  expect(types).toBe(touch ? 'wheel-lift,flatbed' : 'flatbed,wheel-lift');
  const order = touch ? ['car-1', 'car-0'] : ['car-0', 'car-1'];
  for (let i = 0; i < 2; i++) {
    if (i === 0) {
      const chosen = await target(order[i]);
      // Cancelling a tap must not summon a truck.
      await down(chosen); await cancel(); await wait('tow-choice');
      await down(chosen); await up(); await wait('hook');
    }
    await expect(app).toHaveAttribute('data-selected', order[i].slice(-1));
    await expect(app).toHaveAttribute('data-tow-type', types.split(',')[Number(order[i].slice(-1))]);
    await expect(page.locator('.traffic-target')).toHaveCount(1);
    await place(order[i]); await wait('hook', 'working'); await page.screenshot({ path: info.outputPath(`loading-${i}.png`) });
    await wait('tow-exit'); await up();
    await page.screenshot({ path: info.outputPath(`loaded-${i}.png`) });
    const exit = await hinted(); expect(exit.to.x < exit.from.x).toBe(order[i] === 'car-0');
    await down(exit.from); await move({ x: (exit.from.x + exit.to.x) / 2, y: (exit.from.y + exit.to.y) / 2 }); await cancel();
    await page.reload(); await wait('tow-exit'); await expect(app).toHaveAttribute('data-tow-type', types.split(',')[Number(order[i].slice(-1))]);
    await go(); await wait(i === 0 ? 'hook' : 'sweeper'); await up();
    await expect(app).toHaveAttribute('data-towed', String(i + 1));
    if (i === 0) { await page.reload(); await wait('hook'); await expect(app).toHaveAttribute('data-tow-types', types); await expect(app).toHaveAttribute('data-colors', colors); await expect(page.locator('.traffic-target')).toHaveCount(1); }
  }
  await go(); await wait('sweep'); await up();
  const h = await hinted(); await down(h.from); await move({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
  await expect(app).toHaveAttribute('data-action', 'dragging'); await page.screenshot({ path: info.outputPath('sweeping.png') });
  await cancel(); const cleaned = Number(await app.getAttribute('data-cleaned')); expect(cleaned).toBeGreaterThan(0); expect(cleaned).toBeLessThan(9);
  await page.reload(); await wait('sweep'); await expect(app).toHaveAttribute('data-cleaned', String(cleaned)); await expect(app).toHaveAttribute('data-colors', colors);
  await go(); await wait('ambulance'); await up(); await expect(app).toHaveAttribute('data-cleaned', '9');
  await go(); await wait('stretcher'); await up(); await page.screenshot({ path: info.outputPath('stretcher.png') });
  await place('patient'); await wait('boarding'); await up(); await place('ambulance'); await wait('complete'); await up();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'); await page.screenshot({ path: info.outputPath('complete.png') });
  await page.reload(); await wait('complete'); await page.locator('.finish-home').click(); await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.traffic-rescue .completed-mark')).toBeVisible();
  await page.getByRole('button', { name: '交通救援隊', exact: true }).click(); await wait('police');
  const next = (await app.getAttribute('data-colors')).split(','); colors.split(',').forEach((color, i) => expect(next[i]).not.toBe(color));
  await expect(app).toHaveAttribute('data-towed', '0'); await expect(app).toHaveAttribute('data-cleaned', '0'); await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '重新開始交通救援任務' }).click(); await expect(app).not.toHaveAttribute('data-colors', next.join(',')); await wait('police');
  expect(errors).toEqual([]);
});

test('traffic ignores shortcuts, rejects contradictory saves and resumes the last legacy car automatically', async ({ page }) => {
  await page.goto('/?dev=1&mission=traffic-rescue&stage=complete'); await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:traffic-rescue', JSON.stringify({ version: 1, phase: 'complete', towed: [false, false] })));
  await page.goto('/#traffic-rescue'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'police'); await expect(page.locator('.dev-panel')).toHaveCount(0);
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  // The old Effect scope finishes saving before the fixture replaces storage.
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:traffic-rescue', JSON.stringify({
    version: 1, phase: 'tow-exit', action: 'ready', elapsed: 0, colors: [1, 3],
    cones: [true, true], towed: [true, false], selected: 1, cleaned: 0, truckX: 10,
    handle: { x: 5, y: 0.7, z: 4.4 },
  })));
  // Change the document URL: a menu-to-mission hash change intentionally starts a new round.
  await page.goto('/?resume=legacy#traffic-rescue');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'hook');
  await expect(page.locator('#app')).toHaveAttribute('data-selected', '1');
  await expect(page.locator('#app')).toHaveAttribute('data-towed', '1');
  await expect(page.locator('#app')).toHaveAttribute('data-colors', '1,3');
  await expect(page.locator('#app')).toHaveAttribute('data-tow-type', 'wheel-lift');
});
