import { test, expect } from '@playwright/test';
import * as THREE from 'three';

const parts = [{ lift: 2.9, height: 2 }, { lift: 2.9, height: 2 }, { lift: 3, height: 0.22 }, { lift: 5.2, height: 2 }, { lift: 5.2, height: 2 }, { lift: 5.3, height: 1.2 }];
test('build two floors with four vehicles, resume from menu, decorate and replay', async ({ page }, info) => {
  const touch = info.project.name === 'tablet-touch', errors = [];
  page.on('pageerror', e => errors.push(e.message));
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
  const bed = await project(-2.4, 1.7, 0);
  await down(bed); await move({ ...bed, y: bed.y - 25 }); await cancel(); await wait('gravel');
  await expect(app).toHaveAttribute('data-placed', '0');
  await down(bed); await move({ ...bed, y: bed.y - 85 }); await up(); await wait('concrete');
  await page.screenshot({ path: info.outputPath('concrete.png') });
  await down(await project(-0.8, 1.1, 1.8));
  await move(await project(0.4, 1.1, -0.4));
  await expect(app).toHaveAttribute('data-pours', '1'); await cancel(); await wait('concrete');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '修馬路', exact: true }).click();
  await expect(app).toHaveAttribute('data-phase', 'excavator');
  await page.getByRole('button', { name: '回到選關', exact: true }).click();
  await page.getByRole('button', { name: '蓋房子', exact: true }).click(); await wait('concrete');
  await expect(app).toHaveAttribute('data-pours', '1');
  await expect(page.locator('canvas')).toHaveCount(1);
  await down(await project(0.4, 1.1, -0.4));
  await move(await project(2, 1.1, -0.4)); await expect(app).toHaveAttribute('data-pours', '2');
  await move(await project(3.6, 1.1, -0.4)); await expect(app).toHaveAttribute('data-pours', '3'); await up();
  for (let batch = 0; batch < 2; batch++) {
    const delivery = batch === 0 ? 'delivery-one' : 'delivery-two', crane = batch === 0 ? 'crane-one' : 'crane-two';
    await wait(delivery);
    await down(await project(-6, 1.5, 5.1)); await move(await project(-3, 1.5, 5.1)); await up(); await wait(delivery);
    await down(await project(-3, 1.5, 5.1)); await move(await project(0.5, 1.5, 5.1)); await up(); await wait(crane);
    for (let i = batch * 3; i < batch * 3 + 3; i++) {
      await wait(crane);
      const y = parts[i].lift + parts[i].height / 2;
      if (i === 0) {
        await down(await project(-3.1, y, -0.4)); await move(await project(-1, y, 1.5)); await up(); await wait(crane);
        await expect(app).toHaveAttribute('data-placed', '0');
        await down(await project(-3.1, y, -0.4)); await move(await project(2, y, -0.4)); await cancel(); await wait(crane);
        await expect(app).toHaveAttribute('data-placed', '0');
      }
      await down(await project(-3.1, y, -0.4)); await move(await project(2, y, -0.4)); await up();
      await expect(app).toHaveAttribute('data-placed', String(i + 1));
      if (i === 2) await page.screenshot({ path: info.outputPath('first-floor.png') });
    }
  }
  await wait('decorate');
  await page.getByRole('button', { name: '天空藍屋頂' }).click();
  await expect(app).toHaveAttribute('data-color', '2');
  await expect(page.getByRole('button', { name: '天空藍屋頂' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '按門鈴，歡迎入住' }).click(); await wait('complete');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await page.screenshot({ path: info.outputPath('complete.png') });
  await page.reload(); await wait('complete'); await expect(app).toHaveAttribute('data-color', '2');
  await page.locator('.finish-home').click();
  await expect(page.locator('.house-build .completed-mark')).toBeVisible();
  await page.getByRole('button', { name: '蓋房子', exact: true }).click(); await wait('complete');
  await page.getByRole('button', { name: '重新開始蓋房子任務' }).click(); await wait('gravel');
  await expect(app).toHaveAttribute('data-placed', '0'); await expect(app).toHaveAttribute('data-pours', '0');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(errors).toEqual([]);
});

test('phone selection scrolls and malformed progress cannot skip construction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?dev=1&mission=house-build&stage=complete');
  await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:house-build', JSON.stringify({ version: 1, phase: 'complete' })));
  await page.getByRole('button', { name: '蓋房子', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'gravel');
  await expect(page.locator('.dev-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '回到選關', exact: true })).toBeVisible();
});
