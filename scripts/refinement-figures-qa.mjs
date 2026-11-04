import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { launchBrowser } from './browser-utils.mjs';

const root = (process.env.TEST_URL || 'http://127.0.0.1:4322/').replace(/\/?$/, '/');
const directory = process.env.FIGURE_ARTIFACT_DIR || 'artifacts/refinement/figures';
const report = { checkedAt: new Date().toISOString(), root, passed: false, contexts: [], figures: [], originalLinks: [], noJavaScript: [], errors: [] };
await mkdir(directory, { recursive: true });
const browser = await launchBrowser();
const errors = [];

async function originalPopup(page, link, mode, width) {
  const href = await link.getAttribute('href');
  assert.equal(await link.getAttribute('target'), '_blank');
  assert((await link.getAttribute('rel')).includes('noopener'));
  const expected = new URL(href, root).href;
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  try {
    await popup.waitForLoadState('load');
    assert.equal(popup.url(), expected);
    await popup.locator('img').evaluate(img => img.decode());
    assert(await popup.locator('img').evaluate(img => img.naturalWidth > 0 && img.naturalHeight > 0));
    const response = await page.request.get(expected);
    assert.equal(response.status(), 200);
    assert(response.headers()['content-type']?.includes('image/png'));
    const body = await response.body();
    assert.equal(body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const record = { width, mode, url: expected, status: 200, imageType: 'PNG signature verified', openedInNewTab: true, imageDecoded: true };
    if (mode === 'no JavaScript') report.noJavaScript.push(record); else report.originalLinks.push(record);
  } finally { await popup.close(); }
}

try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1024 }, hasTouch: width === 390 });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); });
    await page.goto(root + 'research/model2gds/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const dialog = page.locator('.figure-viewer');
    const canvas = dialog.locator('.viewer-canvas');
    const image = canvas.locator('img');
    const zoom = dialog.locator('[data-viewer-zoom]');
    const defaultTriggers = page.locator('[data-figure-zoom]:visible');
    const expectedDefault = width === 390 ? 5 : 4;
    assert.equal(await defaultTriggers.count(), expectedDefault, `Default visible figure count at ${width}`);
    assert.equal(await page.locator('.coverage-details').getAttribute('open'), null);
    assert.equal(await page.locator('.figure-mobile-panels').isVisible(), width === 390);

    async function inspect(trigger, name, closeWithEscape) {
      const href = new URL(await trigger.getAttribute('href'), root).href;
      const label = await trigger.getAttribute('data-figure-label');
      await trigger.scrollIntoViewIfNeeded();
      if (width === 390) await trigger.tap(); else await trigger.click();
      await expect(dialog).toBeVisible();
      assert.equal(await dialog.evaluate(el => el.open && el.matches(':modal')), true, 'Native modal dialog is open');
      await image.evaluate(img => img.decode());
      assert.equal(await image.getAttribute('src'), href);
      assert((await image.getAttribute('alt')).length > 0);
      assert.equal(await dialog.locator('#figure-viewer-title').innerText(), label);
      assert.equal(await zoom.getAttribute('aria-pressed'), 'false');
      const fit = await canvas.evaluate(el => {
        const img = el.querySelector('img');
        return { clientWidth: el.clientWidth, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, imageWidth: img.getBoundingClientRect().width, imageHeight: img.getBoundingClientRect().height };
      });
      assert(fit.imageWidth <= fit.clientWidth + 1 && fit.imageHeight <= fit.clientHeight + 1, `Initial fit ${name}`);
      const bounds = await dialog.boundingBox();
      assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1, `Dialog fits viewport ${name}`);
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true, `No horizontal toolbar overflow ${name}`);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const axeViolations = axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
      if (axeViolations.length) errors.push(`axe dialog ${width}/${name}: ${axeViolations.map(v => v.id).join(', ')}`);
      await page.screenshot({ path: `${directory}/${width}-${name}-fit.png` });
      await zoom.click();
      assert.equal(await zoom.innerText(), 'Fit image');
      assert.equal(await zoom.getAttribute('aria-pressed'), 'true');
      const actual = await canvas.evaluate(el => {
        const img = el.querySelector('img');
        return { clientWidth: el.clientWidth, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight, imageWidth: img.getBoundingClientRect().width, imageHeight: img.getBoundingClientRect().height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
      });
      assert(Math.abs(actual.imageWidth - actual.naturalWidth) <= 1 && Math.abs(actual.imageHeight - actual.naturalHeight) <= 1, `Zoom uses natural image pixels ${name}`);
      const horizontal = actual.scrollWidth > actual.clientWidth + 1;
      const vertical = actual.scrollHeight > actual.clientHeight + 1;
      assert(horizontal || vertical, `Zoom creates inspectable overflow ${name}`);
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + Math.min(box.width / 2, 120), box.y + Math.min(box.height / 2, 120));
      if (horizontal) {
        await page.mouse.wheel(260, 0);
        await expect.poll(() => canvas.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      }
      if (vertical) {
        await page.mouse.wheel(0, 260);
        await expect.poll(() => canvas.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      }
      const pan = await canvas.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop }));
      await page.screenshot({ path: `${directory}/${width}-${name}-zoomed.png` });
      await zoom.click();
      assert.equal(await zoom.innerText(), 'Zoom in');
      assert.equal(await zoom.getAttribute('aria-pressed'), 'false');
      const restored = await canvas.evaluate(el => ({ x: el.scrollLeft, y: el.scrollTop, fits: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1 }));
      assert(restored.fits && restored.x === 0 && restored.y === 0, `Fit restores size and position ${name}`);
      if (closeWithEscape) await page.keyboard.press('Escape'); else await dialog.locator('[data-viewer-close]').click();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      report.figures.push({ width, name, label, url: href, initialFit: fit, naturalSizeZoom: actual, panDirections: { horizontal, vertical }, actualPan: pan, fitRestored: true, closeMethod: closeWithEscape ? 'Escape' : 'Close button', focusRestored: true, axeViolations });
    }

    for (let index = 0; index < expectedDefault; index++) await inspect(defaultTriggers.nth(index), `default-${index + 1}`, index % 2 === 0);
    await page.locator('.coverage-details > summary').click();
    await expect(page.locator('.coverage-details')).toHaveAttribute('open', '');
    const coverage = page.locator('.coverage-details [data-figure-zoom]:visible');
    assert.equal(await coverage.count(), 1);
    await inspect(coverage, 'coverage', false);
    const fullLinks = page.locator('.figure-open:visible');
    assert.equal(await fullLinks.count(), 5);
    for (let index = 0; index < 5; index++) await originalPopup(page, fullLinks.nth(index), 'Full-resolution link', width);
    report.contexts.push({ width, newBrowserContext: true, defaultVisibleTriggers: expectedDefault, coverageOpened: true, fullOriginalLinks: 5 });
    await context.close();

    const noJS = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
    const noJSPage = await noJS.newPage();
    await noJSPage.goto(root + 'research/model2gds/', { waitUntil: 'networkidle' });
    assert.equal(await noJSPage.locator('.figure-viewer').isVisible(), false);
    const fallbackLinks = noJSPage.locator('[data-figure-zoom]:visible');
    assert.equal(await fallbackLinks.count(), expectedDefault);
    for (let index = 0; index < expectedDefault; index++) await originalPopup(noJSPage, fallbackLinks.nth(index), 'no JavaScript', width);
    await noJSPage.locator('.coverage-details > summary').click();
    await originalPopup(noJSPage, noJSPage.locator('.coverage-details [data-figure-zoom]:visible'), 'no JavaScript', width);
    await noJSPage.screenshot({ path: `${directory}/${width}-no-javascript.png` });
    await noJS.close();
  }
  report.errors = [...new Set(errors)];
  report.passed = report.errors.length === 0;
} catch (error) { report.errors = [...new Set([...errors, error.stack])]; }
finally { await browser.close(); await writeFile(`${directory}/figures-qa.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: report.passed, contexts: report.contexts, figures: report.figures.length, originalLinks: report.originalLinks.length, noJavaScript: report.noJavaScript.length, errors: report.errors }, null, 2));
if (!report.passed) process.exitCode = 1;
