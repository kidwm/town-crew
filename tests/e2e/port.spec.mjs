import { test, expect } from '@playwright/test';
import { gesture } from './gesture.mjs';
import { fireControls } from './fire-controls.mjs';
import { withPausedClock } from './timing.mjs';

for (const layout of [0, 1]) {
  test(`port layout ${layout}: two crane lifts and two forklift trips complete with retained cargo`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const touch = info.project.name === 'tablet-touch', errors = [];
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await page.addInitScript(n => { Math.random = () => n; }, layout ? 0.6 : 0.1);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await expect(page.locator('.mission-card')).toHaveCount(6);
    await page.getByRole('button', { name: '碼頭搬貨', exact: true }).click();
    const app = page.locator('#app'), { down, move, up, cancel } = await fireControls(page, touch);
    const wait = (phase, action = 'ready') => expect(page.locator(`#app[data-phase="${phase}"][data-action="${action}"]`)).toBeVisible();
    const hinted = async () => { const hint = page.locator('.drag-hint'); await expect(hint).toBeVisible(); return gesture(page, await hint.getAttribute('data-direction')); };
    const directMove = async p => touch ? move(p) : page.mouse.move(p.x, p.y);
    const centre = async locator => { await expect(locator).toBeVisible(); const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const source = id => centre(page.locator(`.port-source[data-cargo="${id}"]`));
    async function startDrive() { const h = await hinted(); await down(h.from); await directMove(h.to); }
    async function go(next, action = 'ready') { await startDrive(); await wait(next, action); await up(); }
    await wait('boat'); await expect(app).toHaveAttribute('data-layout', String(layout)); await expect(app).toHaveAttribute('data-direction', 'unload');
    const palette = await app.getAttribute('data-palette');
    await down({ x: 14, y: 155 }); await up(); await wait('boat');
    const ship = await hinted(); await down(ship.from); await up(); await wait('boat');
    expect(JSON.parse(await app.getAttribute('data-work')).boat).toBe(0);
    await down(ship.from); await directMove({ x: (ship.from.x + ship.to.x) / 2, y: (ship.from.y + ship.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).boat).toBeGreaterThan(0.05);
    await cancel(); await wait('boat'); const partial = await app.getAttribute('data-work');
    await page.reload(); await wait('boat'); await expect(app).toHaveAttribute('data-work', partial); await expect(app).toHaveAttribute('data-palette', palette);
    await go('truck'); await go('unload');
    await page.screenshot({ path: info.outputPath('port-crane.png') });
    const first = (layout + Number(touch)) % 2;
    // A quick pass/cancellation at the real quay target cannot unload a pallet.
    await withPausedClock(page, async () => {
      const from = await source(first), to = await centre(page.locator('.port-target'));
      await down(from); await directMove(to); await page.clock.runFor(120); await cancel(); await page.clock.runFor(32);
      await expect(app).toHaveAttribute('data-unloaded', '');
    });
    await wait('unload'); await expect(app).toHaveAttribute('data-selected', String(first));
    await page.reload(); await wait('unload'); await expect(app).toHaveAttribute('data-selected', String(first));
    let h = await hinted(); await down(h.from); await directMove(h.to);
    await expect(app).toHaveAttribute('data-unloaded', String(first)); await wait('unload');
    // Keeping the same finger down cannot choose the next box after automatic lowering.
    const secondFrom = await source(1 - first), secondTo = await centre(page.locator('.port-target'));
    await directMove(secondFrom); await directMove(secondTo); await page.waitForTimeout(500);
    await expect(app).toHaveAttribute('data-unloaded', String(first)); await expect(app).toHaveAttribute('data-selected', ''); await up();
    await page.reload(); await wait('unload'); await expect(app).toHaveAttribute('data-unloaded', String(first));
    await down(await source(1 - first)); await directMove(await centre(page.locator('.port-target'))); await up();
    await wait('forklift'); await expect(app).toHaveAttribute('data-unloaded', `${first},${1 - first}`);
    // Mouse reverses the crane order; touch keeps it, covering both vacant bays.
    const forkFirst = touch ? first : 1 - first;
    for (const id of [forkFirst, 1 - forkFirst]) {
      if (id !== forkFirst) {
        h = await hinted(); await down(h.from); await directMove({ x: h.from.x + (h.to.x - h.from.x) * 0.75, y: h.from.y + (h.to.y - h.from.y) * 0.75 });
        await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).fork).toBeGreaterThan(0.04);
        await cancel(); await wait('forklift'); const shortcutWork = await app.getAttribute('data-work');
        await page.reload(); await wait('forklift'); await expect(app).toHaveAttribute('data-work', shortcutWork); await expect(app).toHaveAttribute('data-selected', String(id));
      }
      h = await hinted(); const pallet = await source(id); await down(h.from); await directMove(pallet);
      await expect(app).toHaveAttribute('data-selected', String(id)); await expect(app).toHaveAttribute('data-carrying', 'true'); await wait('forklift');
      await directMove((await hinted()).to); await page.waitForTimeout(450);
      expect(JSON.parse(await app.getAttribute('data-work')).fork).toBe(0); await up();
      if (id === forkFirst) {
        await page.screenshot({ path: info.outputPath('port-forklift.png') });
        h = await hinted(); await down(h.from); await directMove({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
        await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).fork).toBeGreaterThan(0.04);
        await cancel(); await wait('forklift'); const forkWork = await app.getAttribute('data-work');
        await page.reload(); await wait('forklift'); await expect(app).toHaveAttribute('data-work', forkWork); await expect(app).toHaveAttribute('data-carrying', 'true');
      } else await page.screenshot({ path: info.outputPath('port-second-pickup.png') });
      await startDrive(); await expect(app).toHaveAttribute('data-loaded', id === forkFirst ? String(id) : `${forkFirst},${1 - forkFirst}`); await up();
      if (id === forkFirst) {
        await wait('forklift'); await page.reload(); await wait('forklift'); await expect(app).toHaveAttribute('data-loaded', String(id));
        await expect(page.locator('.port-source')).toHaveCount(1);
        await page.screenshot({ path: info.outputPath('port-second-route.png') });
      }
    }
    await wait('transport'); await page.screenshot({ path: info.outputPath('port-loaded-truck.png') });
    await go('arrival', 'auto'); await page.reload(); await wait('complete', 'auto');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'); await expect(page.locator('.port-truck-arrival')).toBeVisible(); await expect(page.locator('.port-boat-arrival')).toBeHidden();
    await page.screenshot({ path: info.outputPath('port-complete.png') });
    await page.reload(); await wait('complete', 'auto'); await page.locator('.finish-home').click();
    await expect(page.locator('.port-cargo .completed-mark')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(0);
    await page.getByRole('button', { name: '碼頭搬貨', exact: true }).click(); await wait('boat');
    await expect(app).toHaveAttribute('data-direction', 'load'); await expect(app).toHaveAttribute('data-loaded', '');
    await page.getByRole('button', { name: '重新開始碼頭搬貨任務' }).click();
    await wait('boat'); await expect(app).toHaveAttribute('data-direction', 'unload'); await expect(page.locator('canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

for (const layout of [0, 1]) {
  test(`port layout ${layout}: unload the truck, load the ship and deliver to the opposite town`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const touch = info.project.name === 'tablet-touch', errors = [];
    if (touch) await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install(); await page.addInitScript(n => { Math.random = () => n; }, layout ? 0.8 : 0.3);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/#port-cargo');
    const app = page.locator('#app'), { down, move, up, cancel, wait } = await fireControls(page, touch);
    const hinted = async () => gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
    const directMove = async p => touch ? move(p) : page.mouse.move(p.x, p.y);
    const centre = async locator => { await expect(locator).toBeVisible(); const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const source = id => centre(page.locator(`.port-source[data-cargo="${id}"]`));
    const startDrive = async () => { const h = await hinted(); await down(h.from); await directMove(h.to); };
    await wait('boat'); await expect(app).toHaveAttribute('data-direction', 'load'); await expect(app).toHaveAttribute('data-layout', String(layout));
    const palette = await app.getAttribute('data-palette');
    await startDrive(); await wait('truck'); await up(); await startDrive(); await wait('forklift'); await up();
    await expect(app).toHaveAttribute('data-unloaded', ''); await expect(app).toHaveAttribute('data-loaded', '');
    await page.screenshot({ path: info.outputPath('port-outgoing-truck.png') });
    const first = (layout + Number(touch)) % 2;
    for (const id of [first, 1 - first]) {
      let h = await hinted(); const pallet = await source(id); await down(h.from); await directMove(pallet);
      await expect(app).toHaveAttribute('data-selected', String(id)); await expect(app).toHaveAttribute('data-carrying', 'true'); await wait('forklift');
      // Pickup automation consumes this gesture; the same finger cannot also unload.
      await directMove((await hinted()).to); await page.waitForTimeout(450);
      expect(JSON.parse(await app.getAttribute('data-work')).fork).toBe(0); await up();
      await page.screenshot({ path: info.outputPath(`port-outgoing-pickup-${id}.png`) });
      if (id === first) {
        h = await hinted(); await down(h.from); await directMove({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
        await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).fork).toBeGreaterThan(0.04);
        await cancel(); await wait('forklift'); const work = await app.getAttribute('data-work');
        await page.reload(); await wait('forklift'); await expect(app).toHaveAttribute('data-work', work); await expect(app).toHaveAttribute('data-carrying', 'true');
        await expect(app).toHaveAttribute('data-direction', 'load'); await expect(app).toHaveAttribute('data-palette', palette);
      }
      await startDrive(); await expect(app).toHaveAttribute('data-unloaded', id === first ? String(id) : `${first},${1 - first}`); await up();
      if (id === first) { await wait('forklift'); await page.reload(); await wait('forklift'); await expect(app).toHaveAttribute('data-unloaded', String(id)); await expect(page.locator('.port-source')).toHaveCount(1); }
    }
    await wait('load-ship'); await expect(app).toHaveAttribute('data-loaded', '');
    await page.screenshot({ path: info.outputPath('port-outgoing-crane.png') });
    const craneFirst = touch ? first : 1 - first;
    await withPausedClock(page, async () => {
      await down(await source(craneFirst)); await directMove(await centre(page.locator('.port-target'))); await page.clock.runFor(120); await cancel(); await page.clock.runFor(32);
      await expect(app).toHaveAttribute('data-loaded', '');
    });
    await wait('load-ship'); await expect(app).toHaveAttribute('data-selected', String(craneFirst));
    await page.reload(); await wait('load-ship'); await expect(app).toHaveAttribute('data-selected', String(craneFirst));
    let h = await hinted(); await down(h.from); await directMove(h.to);
    await expect(app).toHaveAttribute('data-loaded', String(craneFirst)); await wait('load-ship');
    await directMove(await source(1 - craneFirst)); await directMove(await centre(page.locator('.port-target'))); await page.waitForTimeout(450);
    await expect(app).toHaveAttribute('data-loaded', String(craneFirst)); await expect(app).toHaveAttribute('data-selected', ''); await up();
    await page.reload(); await wait('load-ship'); await expect(app).toHaveAttribute('data-loaded', String(craneFirst));
    await down(await source(1 - craneFirst)); await directMove(await centre(page.locator('.port-target'))); await up();
    await wait('ship-transport'); await expect(app).toHaveAttribute('data-loaded', `${craneFirst},${1 - craneFirst}`);
    await page.screenshot({ path: info.outputPath('port-outgoing-loaded-ship.png') });
    h = await hinted(); await down(h.from); await directMove({ x: (h.from.x + h.to.x) / 2, y: (h.from.y + h.to.y) / 2 });
    await expect.poll(async () => JSON.parse(await app.getAttribute('data-work')).haul).toBeGreaterThan(0.04);
    await cancel(); await wait('ship-transport'); const work = await app.getAttribute('data-work');
    await page.reload(); await wait('ship-transport'); await expect(app).toHaveAttribute('data-work', work);
    await startDrive(); await wait('arrival', 'auto'); await up(); await page.reload(); await wait('complete', 'auto');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'); await expect(page.locator('.port-boat-arrival')).toBeVisible(); await expect(page.locator('.port-truck-arrival')).toBeHidden();
    await page.screenshot({ path: info.outputPath('port-outgoing-complete.png') });
    await page.reload(); await wait('complete', 'auto'); await page.locator('.finish-restart').click(); await wait('boat');
    await expect(app).toHaveAttribute('data-direction', 'unload'); await expect(app).toHaveAttribute('data-loaded', ''); await expect(page.locator('canvas')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('port rejects contradictory snapshots and ignores production development parameters', async ({ page }) => {
  await page.goto('/?dev=1&mission=port-cargo&stage=complete'); await expect(page.locator('#app')).toHaveAttribute('data-screen', 'menu');
  await page.evaluate(() => sessionStorage.setItem('town-crew:play:v1:port-cargo', JSON.stringify({ version: 1, phase: 'complete', loaded: [0, 0] })));
  await page.goto('/#port-cargo'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'boat'); await expect(page.locator('.dev-panel')).toHaveCount(0);
});

test('cancelled berth dwell reloads at the same position and resumes with a fresh hold', async ({ page }, info) => {
  const touch = info.project.name === 'tablet-touch';
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install(); await page.goto('/#port-cargo');
  const app = page.locator('#app'), { down, move, up, cancel, wait } = await fireControls(page, touch);
  await wait('boat');
  const hinted = async () => gesture(page, await page.locator('.drag-hint').getAttribute('data-direction'));
  await withPausedClock(page, async () => {
    const h = await hinted(); await down(h.from);
    if (touch) await move(h.to); else await page.mouse.move(h.to.x, h.to.y);
    await page.clock.runFor(3000); expect(JSON.parse(await app.getAttribute('data-work')).boat).toBe(1);
    await cancel(); await page.clock.runFor(32); await expect(app).toHaveAttribute('data-phase', 'boat');
  });
  await page.reload(); await wait('boat'); expect(JSON.parse(await app.getAttribute('data-work')).boat).toBe(1);
  await down((await hinted()).from); await wait('truck'); await up();
});
