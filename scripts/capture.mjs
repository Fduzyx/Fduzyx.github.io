import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { launchBrowser } from './browser-utils.mjs';

const phase = process.argv[2] || 'final';
assert(/^[a-z0-9][a-z0-9_-]*$/i.test(phase), 'Use a simple phase name, not a filesystem path');
const root = (process.env.TEST_URL || 'http://127.0.0.1:4322/').replace(/\/?$/, '/');
const directory = `artifacts/final-revision/${phase}`;
await mkdir(directory, { recursive: true });
const report = { capturedAt: new Date().toISOString(), phase, root, passed: false, records: [], errors: [] };
const browser = await launchBrowser();
try {
  for (const path of ['', 'research/accelerator/', 'research/gpu-simulation/', 'research/model2gds/']) {
    const slug = path ? path.split('/')[1] : 'home';
    for (const [width, height, device] of [[1672, 941, 'reference'], [1440, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'mobile'], [320, 844, 'small']]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(`JavaScript: ${error.message}`));
      page.on('console', message => { if (message.type() === 'error') errors.push(`Console: ${message.text()}`); });
      try {
        const response = await page.goto(root + path, { waitUntil: 'networkidle' });
        assert.equal(response?.status(), 200, `Capture requires a healthy page: ${path}`);
        if (!path) assert.equal(await page.locator('.research-card').count(), 3, 'All three research cards must be present');
        else assert.equal(await page.locator('.chapter-copy').count(), 4, 'All four research chapters must be present');
        await page.locator('img[loading="lazy"]').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
        await page.evaluate(async () => {
          await document.fonts.ready;
          const images = [...document.images].filter(img => !(img.closest('dialog:not([open])') && !img.getAttribute('src') && !img.currentSrc));
          await Promise.all(images.map(img => img.decode()));
        });
        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          h1: document.querySelectorAll('h1').length,
          textSize: document.querySelector('.chapter-copy p:not(.eyebrow), .about-copy p:not(.eyebrow)') ? getComputedStyle(document.querySelector('.chapter-copy p:not(.eyebrow), .about-copy p:not(.eyebrow)')).fontSize : null,
          images: [...document.images].filter(img => !(img.closest('dialog:not([open])') && !img.getAttribute('src') && !img.currentSrc)).map(img => ({ src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0 })),
        }));
        const screenshot = `${directory}/${slug}-${device}.png`;
        const fullScreenshot = `${directory}/${slug}-${device}-full.png`;
        await page.screenshot({ path: screenshot });
        await page.screenshot({ path: fullScreenshot, fullPage: true });
        report.records.push({ path, width, height, device, screenshot, fullScreenshot, errors, ...metrics });
        assert(metrics.scrollWidth <= width, `Horizontal overflow: ${slug} ${width}`);
        assert.equal(metrics.h1, 1, `One h1: ${slug} ${width}`);
        assert(metrics.images.every(img => img.loaded), `Images loaded: ${slug} ${width}`);
        assert.equal(errors.length, 0, `Browser errors: ${slug} ${width}`);
      } finally { await context.close(); }
    }
  }
  assert.equal(report.records.length, 20, 'All four pages at all five widths are required');
  report.passed = true;
} catch (error) { report.errors.push(error.stack); }
finally { await browser.close(); await writeFile(`${directory}/measurements.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: report.passed, pairs: report.records.length, directory, errors: report.errors }, null, 2));
if (!report.passed) process.exitCode = 1;
