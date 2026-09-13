import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { gesture } from './gesture.mjs';
import { withPausedClock } from './timing.mjs';

const parts = [{ lift: 2.9, height: 2 }, { lift: 2.9, height: 2 }, { lift: 3, height: 0.22 }, { lift: 5.2, height: 2 }, { lift: 5.2, height: 2 }, { lift: 5.3, height: 1.2 }];
test('build two floors, choose the roof before lifting, reload and restart from menu', async ({ page }, info) => {
  // The software-rendered CI trace reached decoration at the four-minute
  // suite limit. Leave time for reload, the completion badge and replay too.
  if (process.env.CI) test.setTimeout(360_000);
  const touch = info.project.name === 'tablet-touch', errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  await page.goto('/');
  await expect(page.getByRole('button', { name: '修馬路', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('menu.png') });
  await page.getByRole('button', { name: '蓋房子', exact: true }).click();
  const cdp = await page.context().newCDPSession(page);
  const app = page.locator('#app');
  const wait = (phase, action = 'ready') => page.locator(`#app[data-phase="${phase}"][data-action="${action}"]`).waitFor();
  async function project(x, y, z) {
    const rect = await page.locator('canvas').boundingBox();
    const aspect = rect.width / rect.height, height = Math.max(14.5, 24 / aspect);
    const camera = new THREE.OrthographicCamera(-height * aspect / 2, height * aspect / 2, height / 2, -height / 2, 0.1, 100);
    camera.position.set(8, 10, 18); camera.lookAt(0, 1.8, 0.5); camera.updateMatrixWorld(true);
    const point = new THREE.Vector3(x, y, z).project(camera);
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
  }
  const down = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }) : (await page.mouse.move(p.x, p.y), page.mouse.down());
  const move = async p => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }) : page.mouse.move(p.x, p.y, { steps: 6 });
  const up = async () => touch ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up();
  const cancel = async () => { if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); else { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up(); } };
  await wait('gravel');
  const tipping = await gesture(page, 'up'), bed = tipping.from;
  await page.screenshot({ path: info.outputPath('gravel-gesture.png') });
  await down(bed); await move({ ...bed, y: bed.y - 25 });
  await expect(page.locator('.drag-hint')).toBeHidden();
  await cancel(); await wait('gravel');
  await expect(app).toHaveAttribute('data-placed', '0');
  await gesture(page, 'up');
  await down(bed); await move(tipping.to); await up(); await wait('concrete');
  await page.screenshot({ path: info.outputPath('concrete.png') });
  await down(await project(-0.8, 1.1, 1.8));
  await move(await project(0.4, 1.1, -0.4));
  await expect(app).toHaveAttribute('data-pours', '1'); await cancel(); await wait('concrete');
  await page.reload(); await wait('concrete');
  await expect(app).toHaveAttribute('data-pours', '1');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '修馬路', exact: true }).click();
  await expect(app).toHaveAttribute('data-phase', 'excavator');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await page.getByRole('button', { name: '蓋房子', exact: true }).click(); await wait('gravel');
  await expect(app).toHaveAttribute('data-pours', '0');
  await expect(app).toHaveAttribute('data-placed', '0');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('canvas')).toHaveCount(1);
  const freshTip = await gesture(page, 'up');
  await down(freshTip.from); await move(freshTip.to); await up(); await wait('concrete');
  await down(await project(-0.8, 1.1, 1.8));
  await move(await project(0.4, 1.1, -0.4)); await expect(app).toHaveAttribute('data-pours', '1');
  await move(await project(2, 1.1, -0.4)); await expect(app).toHaveAttribute('data-pours', '2');
  await move(await project(3.6, 1.1, -0.4)); await expect(app).toHaveAttribute('data-pours', '3'); await up();
  for (let batch = 0; batch < 2; batch++) {
    const delivery = batch === 0 ? 'delivery-one' : 'delivery-two', crane = batch === 0 ? 'crane-one' : 'crane-two';
    await wait(delivery);
    const driving = await gesture(page, 'right');
    if (batch === 0) await page.screenshot({ path: info.outputPath('flatbed-gesture.png') });
    await down(driving.from);
    await move({ x: (driving.from.x + driving.to.x) / 2, y: (driving.from.y + driving.to.y) / 2 });
    await expect(page.locator('.drag-hint')).toBeHidden();
    await up(); await wait(delivery);
    const remaining = await gesture(page, 'right');
    await down(remaining.from); await move(remaining.to); await up(); await wait(crane);
    for (let i = batch * 3; i < batch * 3 + 3; i++) {
      if (i === 5) {
        await wait('roof-color');
        await expect(app).toHaveAttribute('data-placed', '5');
        await expect(page.getByRole('img', { name: '吊車放置位置' })).toBeHidden();
        await expect(page.getByRole('button', { name: '按門鈴，歡迎入住' })).toBeHidden();
        await page.getByRole('button', { name: '天空藍屋頂' }).click();
        await expect(app).toHaveAttribute('data-color', '2');
        await page.screenshot({ path: info.outputPath('roof-color-before-lift.png') });
        await page.reload(); await wait('roof-color');
        await expect(app).toHaveAttribute('data-color', '2');
        await expect(page.getByRole('button', { name: '天空藍屋頂' })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: '吊起選好的屋頂' }).click();
        await expect(page.locator('.roof-picker')).toBeHidden();
      }
      await wait(crane);
      const part = parts[i];
      // Grab visible faces, slab, hook and roof, instead of only the invisible
      // centre of the L-shaped walls. Each grip has a different drag offset.
      const grip = i === 0 || i === 3 ? [-4.2, part.lift + 1, 1.2]
        : i === 1 ? [-1.1, part.lift + 1, 0.2]
        : i === 2 ? [-2.4, part.lift + 0.22, 0.2]
        : i === 4 ? [-3.1, part.lift + part.height + 0.2, -0.4]
        : [-2.3, part.lift + 0.79, 0.2];
      const source = await project(...grip);
      const indicator = page.getByRole('img', { name: '吊車放置位置' });
      await expect(indicator).toBeVisible();
      const circle = await indicator.boundingBox();
      const target = { x: circle.x + circle.width / 2, y: circle.y + circle.height / 2 };
      if (i === 0) {
        await down(source); await move({ x: Math.max(10, source.x - 90), y: source.y + 40 });
        await expect(indicator).toHaveAttribute('data-ready', 'false');
        await up(); await wait(crane);
        await expect(app).toHaveAttribute('data-placed', '0');
        await withPausedClock(page, async () => {
          await down(source); await move(target); await page.clock.runFor(120); await cancel();
        });
        await wait(crane);
        await expect(app).toHaveAttribute('data-placed', '0');
      }
      await down(source);
      // Aim at the actual assembly base, including an imprecise edge grip.
      await move(i === 1 ? { ...target, y: target.y + circle.height / 2 - 8 } : target);
      // Keep holding for most lifts. Releasing early at a valid site also works.
      if (i === 1) await up();
      await expect(app).toHaveAttribute('data-placed', String(i + 1));
      if (i !== 1) await up();
      if (i === 0) await page.screenshot({ path: info.outputPath('crane-base-installed.png') });
      if (i === 2) await page.screenshot({ path: info.outputPath('first-floor.png') });
    }
  }
  await wait('decorate');
  await expect(app).toHaveAttribute('data-color', '2');
  await expect(page.locator('.roof-picker')).toBeHidden();
  await page.getByRole('button', { name: '按門鈴，歡迎入住' }).click(); await wait('complete');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await page.screenshot({ path: info.outputPath('complete.png') });
  await page.reload(); await wait('complete'); await expect(app).toHaveAttribute('data-color', '2');
  await page.locator('.finish-home').click();
  await expect(page.locator('.house-build .completed-mark')).toBeVisible();
  await expect(page.locator('.house-build .card-play')).toContainText('再玩一次');
  await page.getByRole('button', { name: '蓋房子', exact: true }).click(); await wait('gravel');
  await expect(app).toHaveAttribute('data-placed', '0'); await expect(app).toHaveAttribute('data-pours', '0');
  await expect(app).toHaveAttribute('data-color', '0');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: '重新開始蓋房子任務' }).click(); await wait('gravel');
  expect(errors).toEqual([]);
});

test('phone selection scrolls and malformed progress cannot skip construction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?dev=1&mission=house-build&stage=complete');
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:house-build', JSON.stringify({ version: 1, phase: 'complete' })));
  await page.goto('/#house-build');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'gravel');
  await expect(page.locator('.dev-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '回到選關', exact: true })).toBeVisible();
});
