import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const directory = new URL('../public/icons/', import.meta.url);
const svg = await readFile(new URL('town-crew.svg', directory), 'utf8');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
try {
  for (const [name, size] of [
    ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512],
    ['apple-touch-icon.png', 180], ['favicon-32.png', 32],
  ]) {
    // The house and vehicle already fit inside the central 80% safe circle.
    // Keep a full opaque background so launchers can apply any icon mask.
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>body{margin:0}img{display:block;width:100%;height:100%}</style><img src="data:image/svg+xml,${encodeURIComponent(svg)}">`);
    await page.locator('img').evaluate(img => img.decode());
    await page.screenshot({ path: fileURLToPath(new URL(name, directory)) });
    await page.close();
    console.log(`Created ${name} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
