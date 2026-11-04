import { launchBrowser } from './browser-utils.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = process.env.TEST_URL || 'http://127.0.0.1:4323/personal-website/';
await mkdir('artifacts/reports', { recursive: true });
const browser = await launchBrowser();
const report = { root, checkedAt: new Date().toISOString(), pages: [], passed: false };
try {
  for (const width of [390, 1672]) {
    const page = await browser.newPage({ viewport: { width, height: 941 } });
    await page.goto(root, { waitUntil: 'networkidle' });
    await page.locator('img').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
    await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode())));
    const src = await page.locator('.hero-image').evaluate(img => img.currentSrc);
    assert.ok(src.startsWith(root));
    assert.ok(src.endsWith(width === 390 ? 'wafer-mobile.avif' : 'wafer.webp'));
    for (const path of ['images/hero/wafer-mobile.avif', 'images/hero/wafer-mobile.webp', 'research/model2gds/', 'Yixuan_Zhuang_CV.pdf']) assert.equal((await page.request.get(root + path)).status(), 200);
    report.pages.push({ width, heroSource: src, imagesDecoded: true, resourcesReturned200: true });
    await page.close();
  }
  report.passed = true;
} finally { await browser.close(); await writeFile('artifacts/reports/project-final-image-smoke.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
