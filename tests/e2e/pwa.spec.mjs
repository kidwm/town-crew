import { test, expect } from '@playwright/test';
import { cloudflarePreview } from './cloudflare-preview.mjs';

async function waitForOfflineReady(page) {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('install manifest and all home-screen icons are valid', async ({ page, browserName }) => {
  await page.goto('/');
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const response = await fetch(link.href);
    if (!response.ok) throw new Error('Manifest could not be loaded');
    return response.json();
  });
  expect(manifest.name).toBe('小小城市隊 · Town Crew');
  expect(manifest.display).toBe('standalone');
  expect(new URL(manifest.start_url, page.url()).hash).toBe('#menu');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
    expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
  ]));
  for (const icon of manifest.icons) {
    const dimensions = await page.evaluate(async src => {
      const img = new Image(); img.src = src; await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, icon.src);
    expect(dimensions).toBe(icon.sizes);
  }
  const appleSize = await page.evaluate(async () => {
    const img = new Image(); img.src = document.querySelector('link[rel="apple-touch-icon"]').href;
    await img.decode(); return [img.naturalWidth, img.naturalHeight];
  });
  expect(appleSize).toEqual([180, 180]);
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const { errors } = await cdp.send('Page.getAppManifest');
    expect(errors).toEqual([]);
    await cdp.detach();
  }
});

test('Cloudflare HTML redirects remain safe for offline navigation and reopening', async ({ page, context, browserName }) => {
  const preview = await cloudflarePreview();
  try {
    // Seed a legacy cache before registration, together with unrelated data.
    await page.goto(`${preview.url}/icons/town-crew.svg`);
    await page.evaluate(async () => {
      const legacy = await caches.open('town-crew:precache:legacy-test');
      await legacy.put('/legacy', new Response('legacy'));
      const unrelated = await caches.open('unrelated-app-test');
      await unrelated.put('/unrelated', new Response('keep'));
    });
    const redirect = await context.request.get(`${preview.url}/index.html`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers().location).toBe('/');
    const previousRedirects = preview.redirects;
    await page.goto(preview.url);
    await waitForOfflineReady(page);
    expect(preview.redirects).toBeGreaterThan(previousRedirects);
    const names = await page.evaluate(() => caches.keys());
    expect(names).not.toContain('town-crew:precache:legacy-test');
    expect(names).toContain('unrelated-app-test');
    // A followed redirect must never be returned as a navigation response.
    const reload = await page.reload();
    expect(reload.fromServiceWorker()).toBe(true);
    await expect(page.locator('.mission-card')).toHaveCount(6);
    // Playwright 1.63 WebKit's offline flag kills SW responses before dispatch:
    // https://github.com/microsoft/playwright/issues/42775
    // Stop the actual origin to verify cache-only navigation without that flag.
    if (browserName === 'webkit') await preview.close();
    else await context.setOffline(true);
    const offlineReload = await page.reload();
    expect(offlineReload.fromServiceWorker()).toBe(true);
    await expect(page.locator('.mission-card')).toHaveCount(6);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(`${preview.url}/?source=home#menu`);
    await expect(reopened.locator('.mission-card')).toHaveCount(6);
    await reopened.close();
  } finally {
    await context.setOffline(false);
    await preview.close();
  }
});

test('menu reloads and all previously unopened missions load offline', async ({ page, context, browserName }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const preview = browserName === 'webkit' ? await cloudflarePreview() : undefined;
  try {
    await page.goto(preview?.url ?? '/');
    await expect(page.locator('.mission-card')).toHaveCount(6);
    await waitForOfflineReady(page);
    if (preview) await preview.close();
    else await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.mission-card')).toHaveCount(6);
    const missions = ['road-repair', 'house-build', 'fire-rescue', 'traffic-rescue', 'police-patrol', 'port-cargo'];
    for (const mission of missions) {
      await page.locator(`.mission-card[data-mission="${mission}"]`).click();
      await expect(page.locator('#app')).toHaveAttribute('data-mission', mission);
      await expect(page.locator('canvas')).toBeVisible();
      await expect(page.locator('.loading')).toBeHidden();
      await page.reload();
      await expect(page.locator('canvas')).toBeVisible();
      await expect(page.locator('.loading')).toBeHidden();
      await page.getByRole('button', { name: '回到選關', exact: true }).click();
      await expect(page.locator('.mission-card')).toHaveCount(6);
    }
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await preview?.close();
  }
});

test('game labels reject selection while fields and menu scrolling remain usable', async ({ page }, info) => {
  const touch = !!info.project.use.hasTouch;
  if (touch) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const selector of ['.menu-intro h1', '.card-title', '.card-description']) {
    await expect(page.locator(selector).first()).toHaveCSS('user-select', 'none');
  }
  await page.locator('.menu-intro h1').dblclick();
  expect(await page.evaluate(() => getSelection().toString())).toBe('');
  // The selection guard must not blanket-disable normal form editing.
  expect(await page.evaluate(() => {
    const input = document.createElement('input');
    input.value = 'Town Crew'; document.querySelector('#app').append(input);
    input.focus(); input.setSelectionRange(0, 4);
    const result = [getComputedStyle(input).userSelect, input.selectionStart, input.selectionEnd];
    input.remove(); return result;
  })).toEqual(['text', 0, 4]);
  const port = page.getByRole('button', { name: '碼頭搬貨', exact: true });
  await port.scrollIntoViewIfNeeded();
  expect(await page.locator('.town-menu').evaluate(menu => menu.scrollTop)).toBeGreaterThan(0);
  if (touch) await port.tap(); else await port.click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.house-instruction')).toHaveCSS('user-select', 'none');
  await expect(page.locator('.controls .home')).toHaveCSS('user-select', 'none');
  await expect(page.locator('canvas')).toHaveCSS('touch-action', 'none');
});
