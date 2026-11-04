import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { launchBrowser } from './browser-utils.mjs';
import AxeBuilder from '@axe-core/playwright';

const root = process.env.TEST_URL || 'http://127.0.0.1:4322/';
const directory = process.env.CONTACT_ARTIFACT_DIR || 'artifacts/refinement/contact';
const email = 'yixuan@yixuanzhuang.com';
await mkdir(directory, { recursive: true });
const report = { checkedAt: new Date().toISOString(), root, passed: false, scenarios: [], errors: [] };
const browser = await launchBrowser();
try {
  for (const width of [320, 390, 768, 1672]) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 941 }, hasTouch: width < 768, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(root, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.wordmark').innerText(), 'YZ.');
    assert.equal(await page.locator('.wordmark').getAttribute('aria-label'), 'YZ. — Yixuan Zhuang — home');
    assert.equal(await page.locator('#hero-title').count(), 1);
    assert(await page.locator('#hero-title').innerText().then(text => text.includes('Yixuan Zhuang')));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}`);
    const heroBox = await page.locator('.hero').boundingBox();
    const contactBox = await page.locator('.email-contact--hero').boundingBox();
    assert(contactBox.y + contactBox.height <= heroBox.y + heroBox.height, `Contact clipped at ${width}`);
    await page.screenshot({ path: `${directory}/home-${width}.png` });
    for (const placement of ['hero', 'footer']) {
      const contact = page.locator(`.email-contact--${placement}`);
      const copy = contact.locator('[data-copy-email]');
      const write = contact.locator('.email-write');
      assert.equal(await write.getAttribute('href'), `mailto:${email}`);
      await write.evaluate(link => link.addEventListener('click', event => { event.preventDefault(); link.dataset.testMailtoClicked = link.href; }, { once: true }));
      await write.click();
      assert.equal(await write.getAttribute('data-test-mailto-clicked'), `mailto:${email}`);
      if (width < 768) await copy.tap();
      else { await copy.focus(); await page.keyboard.press('Enter'); }
      await contact.getByText('Copied', { exact: true }).waitFor();
      const clipboardIsCorrect = await page.evaluate(expected => navigator.clipboard.readText().then(value => value === expected), email);
      assert(clipboardIsCorrect, 'Real browser clipboard contains the exact public email');
      assert.equal(await contact.locator('[data-email-status]').innerText(), 'Email copied to clipboard.');
      assert.equal(await contact.locator('[data-email-fallback]').isVisible(), false);
      if (placement === 'hero') await page.screenshot({ path: `${directory}/copied-${width}.png` });
    }
    await page.locator('.site-footer').screenshot({ path: `${directory}/footer-${width}.png` });
    if (width === 390 || width === 1672) {
      const result = await new AxeBuilder({ page }).include('.email-contact').include('.site-header').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))));
    }
    assert.equal(errors.length, 0, errors.join('; '));
    report.scenarios.push({ width, mode: width < 768 ? 'touch' : 'keyboard Enter', clipboard: 'Real Chromium Clipboard API permission granted; exact address read back', mailto: 'Write email clicked; exact mailto URI verified. External protocol launch prevented in test; OS mail client not assumed.', hero: 'Copied visible and aria-live updated', footer: 'Copied visible and aria-live updated', noOverflow: true, heroContactFullyVisible: true, wordmark: 'YZ. / full name accessible label', consoleErrors: errors });
    await context.close();
  }
  for (const failure of ['rejected', 'unavailable']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, hasTouch: true });
    if (failure === 'rejected') await context.grantPermissions([], { origin: new URL(root).origin });
    else await context.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }); });
    const page = await context.newPage();
    await page.goto(root, { waitUntil: 'networkidle' });
    if (failure === 'rejected') assert.equal(await page.evaluate(() => navigator.permissions.query({ name: 'clipboard-write' }).then(permission => permission.state)), 'denied');
    for (const placement of ['hero', 'footer']) {
      const contact = page.locator(`.email-contact--${placement}`);
      const copy = contact.locator('[data-copy-email]');
      await copy.tap();
      const fallback = contact.locator('[data-email-fallback]');
      await fallback.waitFor({ state: 'visible' });
      const input = fallback.locator('input');
      assert.equal(await input.inputValue(), email);
      assert.equal(await input.evaluate(el => el instanceof HTMLInputElement && document.activeElement === el && el.selectionStart === 0 && el.selectionEnd === el.value.length), true);
      assert.equal(await fallback.getByText('Select the address and copy it. On a touch screen, press and hold.').isVisible(), true);
      const box = await fallback.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= 320 && box.y >= 0 && box.y + box.height <= 844, `Fallback visible in viewport: ${failure}/${placement}`);
      await page.screenshot({ path: `${directory}/${failure}-${placement}-320.png` });
      await page.keyboard.press('Escape');
      assert.equal(await fallback.isVisible(), false);
      assert.equal(await copy.evaluate(el => document.activeElement === el), true);
      await copy.click();
      await fallback.waitFor({ state: 'visible' });
      await fallback.locator('[data-dismiss-email]').click();
      assert.equal(await fallback.isVisible(), false);
      assert.equal(await copy.evaluate(el => document.activeElement === el), true);
      report.scenarios.push({ width: 320, clipboardFailure: failure, failureMechanism: failure === 'rejected' ? 'Native browser permission denied; no Clipboard API mock' : 'Clipboard API removed in isolated browser context to simulate unsupported environment', placement, addressSelectableAndFocused: true, visibleManualInstructions: true, feedbackWithinViewport: true, escapeAndCloseRestoreFocus: true });
    }
    await context.close();
  }
  report.passed = true;
} catch (error) { report.errors.push(error.stack); }
finally { await browser.close(); await writeFile(`${directory}/contact-qa.json`, JSON.stringify(report, null, 2)); }
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
