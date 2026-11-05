import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const directory = new URL('../public/icons/', import.meta.url);
const [townSvg, faviconSvg] = await Promise.all([
  readFile(new URL('town-crew.svg', directory), 'utf8'),
  readFile(new URL('favicon.svg', directory), 'utf8'),
]);
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
try {
  for (const [name, size, svg] of [
    ['icon-192.png', 192, townSvg], ['icon-512.png', 512, townSvg],
    ['icon-maskable-512.png', 512, townSvg], ['apple-touch-icon.png', 180, townSvg],
    ['favicon-16.png', 16, faviconSvg], ['favicon-32.png', 32, faviconSvg],
  ]) {
    // The town artwork fits inside the central 80% safe circle and has an
    // opaque background for launcher masks. Favicons use the separate car SVG.
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
