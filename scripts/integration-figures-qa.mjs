import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { launchBrowser } from './browser-utils.mjs';

const root = (process.env.TEST_URL || 'http://127.0.0.1:4322/').replace(/\/?$/, '/');
const directory = process.env.FIGURE_ARTIFACT_DIR || 'artifacts/final-revision/figures';
const report = { checkedAt: new Date().toISOString(), root, passed: false, contexts: [], figures: [], originals: [], noJavaScript: [], mobileLayouts: [], errors: [] };
await mkdir(directory, { recursive: true });
const browser = await launchBrowser();
const errors = [];

async function checkOriginal(page, link, width, noJavaScript = false) {
  assert.equal(await link.getAttribute('target'), '_blank');
  assert((await link.getAttribute('rel')).split(/\s+/).includes('noopener'));
  const url = new URL(await link.getAttribute('href'), root).href;
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  try {
    await popup.waitForLoadState('load');
    assert.equal(popup.url(), url);
    const img = popup.locator('img');
    await img.evaluate(node => node.decode());
    const size = await img.evaluate(node => ({ width: node.naturalWidth, height: node.naturalHeight }));
    assert(size.width > 0 && size.height > 0);
    const response = await page.request.get(url);
    assert.equal(response.status(), 200);
    const body = await response.body();
    const png = body.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    const webp = body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
    assert(png || webp, 'Original link must serve a genuine PNG or WebP');
    assert(response.headers()['content-type']?.includes(png ? 'image/png' : 'image/webp'));
    (noJavaScript ? report.noJavaScript : report.originals).push({ width, url, status: 200, format: png ? 'PNG' : 'WebP', decoded: size, openedInNewTab: true });
  } finally { await popup.close(); }
}

async function inspectMobileLayout(page, width, noJavaScript = false) {
  const nativeReflows = [];
  const mode = noJavaScript ? 'nojs' : 'js';
  for (const [name, selector] of [['observer', '.read-observer'], ['grid-results', '.read-grid'], ['measurement-window', '.window-study']]) {
    const figure = page.locator(selector);
    await figure.scrollIntoViewIfNeeded();
    const dimensions = await figure.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, viewportWidth: innerWidth, pageWidth: document.documentElement.scrollWidth }));
    assert(dimensions.scrollWidth <= dimensions.width + 1, `${name}: every label must fit without horizontal scrolling`);
    assert(dimensions.pageWidth <= width, `${name}: no page overflow`);
    const box = await figure.boundingBox();
    assert(box.x >= 0 && box.x + box.width <= width + 1);
    await figure.screenshot({ path: `${directory}/${width}-${mode}-${name}-reflow.png` });
    nativeReflows.push({ name, ...dimensions, horizontalScrollingRequired: false });
  }

  const panels = page.locator('.figure-mobile-panels');
  await expect(panels).toBeVisible();
  const links = panels.locator('[data-figure-zoom]');
  assert.equal(await links.count(), 2);
  const top = await links.nth(0).boundingBox();
  const bottom = await links.nth(1).boundingBox();
  assert(bottom.y >= top.y + top.height + 10, 'Weight-stationary panels stack vertically with a readable gap');
  assert(Math.abs(top.x - bottom.x) <= 1 && Math.abs(top.width - bottom.width) <= 1);
  assert.equal(await page.locator('.has-mobile-panels > .figure-complete').isVisible(), false);
  assert((await links.nth(0).getAttribute('href')).endsWith('weight-stationary-boundary.webp'));
  assert((await links.nth(1).getAttribute('href')).endsWith('weight-stationary-addresses.webp'));
  await panels.scrollIntoViewIfNeeded();
  await panels.screenshot({ path: `${directory}/${width}-${mode}-weight-stationary-panels.png` });
  report.mobileLayouts.push({ width, noJavaScript, nativeReflows, weightStationaryPanels: { top, bottom, verticallyStacked: true } });
}

try {
  for (const width of [1440, 768, 390, 320]) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1024 }, hasTouch: mobile });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
    const response = await page.goto(root + 'research/accelerator/', { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.research-figure img').evaluateAll(async images => { await Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })); });
    // Verify the native chart's actual denominators, counts, scale, and table mapping.
    assert.deepEqual(await page.locator('.grid-count').allTextContents(), ['144 / 153', '117 / 153', '72 / 153', '0 / 153']);
    assert.deepEqual(await page.locator('.grid-capacity').allTextContents(), ['1', '4', '16', '512']);
    assert.deepEqual(await page.locator('.grid-bar-range rect').evaluateAll(rects => rects.map(r => [r.getAttribute('y'), r.getAttribute('height')])), [['9','144'], ['36','117'], ['81','72'], ['153','0']]);
    assert.deepEqual(await page.locator('.window-comparison tbody tr').allTextContents(), ['Compute field16,471lower20,991', 'Cold interval82,00656,830lower']);
    const triggers = page.locator('[data-figure-zoom]:visible');
    const expected = mobile ? 2 : 1;
    assert.equal(await triggers.count(), expected);
    assert.equal(await page.locator('.figure-mobile-panels').isVisible(), mobile);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (mobile) await inspectMobileLayout(page, width);

    const dialog = page.locator('.figure-viewer');
    const canvas = dialog.locator('.viewer-canvas');
    const image = canvas.locator('img');
    const zoom = dialog.locator('[data-viewer-zoom]');
    for (let index = 0; index < expected; index++) {
      const trigger = triggers.nth(index);
      const name = `figure-${index + 1}`;
      const url = new URL(await trigger.getAttribute('href'), root).href;
      const label = await trigger.getAttribute('data-figure-label');
      await trigger.scrollIntoViewIfNeeded();
      if (mobile) await trigger.tap(); else await trigger.click();
      await expect(dialog).toBeVisible();
      assert(await dialog.evaluate(node => node.open && node.matches(':modal')));
      await image.evaluate(node => node.decode());
      assert.equal(await image.getAttribute('src'), url);
      assert((await image.getAttribute('alt')).length > 0);
      assert.equal(await dialog.locator('#figure-viewer-title').innerText(), label);
      const measure = () => canvas.evaluate(node => {
        const img = node.querySelector('img');
        return { width: node.clientWidth, height: node.clientHeight, scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight, left: node.scrollLeft, top: node.scrollTop, imageWidth: img.getBoundingClientRect().width, imageHeight: img.getBoundingClientRect().height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
      });
      const fit = await measure();
      assert.equal(await zoom.getAttribute('aria-pressed'), 'false');
      assert(fit.imageWidth <= fit.width + 1 && fit.imageHeight <= fit.height + 1);
      const bounds = await dialog.boundingBox();
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1);
      assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth), 'Dialog toolbar has no horizontal overflow');
      await expect(dialog.locator('[data-viewer-close]')).toBeInViewport();
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const axeViolations = axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
      if (axeViolations.length) errors.push(`axe ${width}/${name}: ${axeViolations.map(v => v.id).join(', ')}`);
      await page.screenshot({ path: `${directory}/${width}-${name}-fit.png` });
      await zoom.click();
      assert.equal(await zoom.getAttribute('aria-pressed'), 'true');
      const actual = await measure();
      assert(Math.abs(actual.imageWidth - actual.naturalWidth) <= 1 && Math.abs(actual.imageHeight - actual.naturalHeight) <= 1, 'Actual-size zoom uses the image natural pixels');
      const horizontal = actual.scrollWidth > actual.width + 1;
      const vertical = actual.scrollHeight > actual.height + 1;
      assert(horizontal || vertical);
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + Math.min(box.width / 2, 120), box.y + Math.min(box.height / 2, 120));
      if (horizontal) { await page.mouse.wheel(260, 0); await expect.poll(() => canvas.evaluate(node => node.scrollLeft)).toBeGreaterThan(0); }
      if (vertical) { await page.mouse.wheel(0, 260); await expect.poll(() => canvas.evaluate(node => node.scrollTop)).toBeGreaterThan(0); }
      const pan = await measure();
      await page.screenshot({ path: `${directory}/${width}-${name}-zoomed.png` });
      await zoom.click();
      assert.equal(await zoom.getAttribute('aria-pressed'), 'false');
      const restored = await measure();
      assert(restored.scrollWidth <= restored.width + 1 && restored.scrollHeight <= restored.height + 1 && restored.left === 0 && restored.top === 0);
      // Every figure proves Escape/focus restoration; the last also proves the visible close button.
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      if (index === expected - 1) {
        await trigger.click();
        await expect(dialog).toBeVisible();
        await dialog.locator('[data-viewer-close]').click();
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
      }
      report.figures.push({ width, name, label, url, fit, actual, pan: { horizontal, vertical, left: pan.left, top: pan.top }, fitRestored: true, escapeAndFocusRestored: true, closeButtonChecked: index === expected - 1, axeViolations });
    }
    const originalLinks = page.locator('.figure-open:visible');
    assert.equal(await originalLinks.count(), 4);
    for (let index = 0; index < 4; index++) await checkOriginal(page, originalLinks.nth(index), width);
    report.contexts.push({ width, newBrowserContext: true, visibleFigures: expected, fullOriginalLinks: 4 });
    await context.close();

    const noJS = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1024 }, javaScriptEnabled: false, hasTouch: mobile });
    const noJSPage = await noJS.newPage();
    assert.equal((await noJSPage.goto(root + 'research/accelerator/', { waitUntil: 'networkidle' })).status(), 200);
    const fallback = noJSPage.locator('[data-figure-zoom]:visible');
    assert.equal(await fallback.count(), expected);
    if (mobile) await inspectMobileLayout(noJSPage, width, true);
    for (let index = 0; index < expected; index++) await checkOriginal(noJSPage, fallback.nth(index), width, true);
    for (const link of await noJSPage.locator('.read-observer .figure-open, .read-grid .figure-open, .window-comparison .figure-open').all()) await checkOriginal(noJSPage, link, width, true);
    // The complete WS figure remains available even while two mobile panels replace its preview.
    if (mobile) await checkOriginal(noJSPage, noJSPage.locator('.has-mobile-panels .figure-open'), width, true);
    await noJSPage.screenshot({ path: `${directory}/${width}-no-javascript.png` });
    await noJS.close();
  }
  assert.equal(report.figures.length, 6);
  assert.equal(report.originals.length, 16);
  assert.equal(report.noJavaScript.length, 20);
  assert.equal(report.mobileLayouts.length, 4);
  report.errors = [...new Set(errors)];
  report.passed = report.errors.length === 0;
} catch (error) { report.errors = [...new Set([...errors, error.stack])]; }
finally { await browser.close(); await writeFile(`${directory}/figures-qa.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: report.passed, contexts: report.contexts, figures: report.figures.length, originalLinks: report.originals.length, noJavaScript: report.noJavaScript.length, nativeReflowChecks: report.mobileLayouts.reduce((count, layout) => count + layout.nativeReflows.length, 0), errors: report.errors }, null, 2));
if (!report.passed) process.exitCode = 1;
