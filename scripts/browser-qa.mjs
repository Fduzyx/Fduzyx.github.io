import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { launchBrowser } from './browser-utils.mjs';
const root = (process.env.TEST_URL || 'http://127.0.0.1:4322/').replace(/\/?$/, '/');
const artifactDir = process.env.QA_ARTIFACT_DIR || 'artifacts';
const screenshotDir = join(artifactDir, 'screenshots');
const reportDir = join(artifactDir, 'reports');
await Promise.all([mkdir(screenshotDir, { recursive: true }), mkdir(reportDir, { recursive: true })]);
const report = { checkedAt: new Date().toISOString(), root, artifactDir, pages: [], interactions: [], internalLinks: [], externalLinks: [], errors: [] };
const browser = await launchBrowser();
const links = new Set();
const issues = [];
try {
  for (const width of (process.env.QA_WIDTHS || '320,390,768,1024,1440,1672').split(',').map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 941 } });
    const page = await context.newPage();
    page.on('pageerror', err => issues.push(`JS ${err.message}`));
    page.on('console', message => { if (message.type() === 'error') issues.push(`Console ${message.text()}`); });
    for (const path of ['', 'research/accelerator/', 'research/gpu-simulation/', 'research/model2gds/', 'credits/']) {
      const response = await page.goto(root + path, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, `${path} HTTP response`);
      await page.locator('img[loading="lazy"]').evaluateAll(images => images.forEach(img => { img.loading = 'eager'; }));
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); });
      const metrics = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        h1: document.querySelectorAll('h1').length,
        images: [...document.images].every(img => {
          const inactiveDialogPlaceholder = img.closest('dialog:not([open])') && !img.getAttribute('src') && !img.currentSrc;
          return inactiveDialogPlaceholder || (img.complete && img.naturalWidth > 0);
        }),
        inactiveDialogPlaceholders: [...document.images].filter(img => img.closest('dialog:not([open])') && !img.getAttribute('src') && !img.currentSrc).length,
        fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family),
        links: [...document.querySelectorAll('a[href]')].map(a => a.href),
        anchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.getAttribute('href').slice(1))).map(a => a.getAttribute('href')),
      }));
      assert.ok(metrics.scrollWidth <= width, `Overflow ${path} at ${width}`);
      assert.equal(metrics.h1, 1, `H1 ${path}`);
      assert.ok(metrics.images, `Images ${path}`);
      assert.equal(metrics.anchors.length, 0, `Anchor targets ${path}`);
      assert.ok(metrics.fonts.includes('Newsreader Variable') && metrics.fonts.includes('Manrope Variable'), `Fonts ${path}`);
      metrics.links.forEach(link => links.add(link));
      const item = { path, width, noOverflow: true, h1: 1, imagesLoaded: true, inactiveDialogPlaceholders: metrics.inactiveDialogPlaceholders, fontsLoaded: true };
      if ([390, 1440].includes(width)) {
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        item.axeViolations = axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
        if (axe.violations.length) {
          issues.push(`axe ${path} ${width}: ${axe.violations.map(v => v.id).join(', ')}`);
          const slug = path ? path.replaceAll('/', '-').replace(/-$/, '') : 'home';
          item.axeScreenshot = join(screenshotDir, `axe-${slug}-${width}.png`);
          await page.screenshot({ path: item.axeScreenshot, fullPage: true });
        }
      }
      report.pages.push(item);
    }
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(root);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'hero-title');
  await page.keyboard.press('Tab');
  assert.ok((await page.locator(':focus').getAttribute('href')).endsWith('Yixuan_Zhuang_CV.pdf'), 'Skip bypasses every navigation link');
  const button = page.locator('.menu-toggle');
  await button.focus();
  await page.keyboard.press('Enter');
  assert.equal(await button.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Home');
  await page.keyboard.press('Escape');
  assert.equal(await button.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator(':focus').getAttribute('aria-controls'), 'primary-navigation');
  await button.click();
  await page.locator('#primary-navigation').getByRole('link', { name: 'Research', exact: true }).click();
  assert.equal(await button.getAttribute('aria-expanded'), 'false');
  assert.ok(page.url().endsWith('#research'));
  assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior), 'auto');
  assert.equal(await page.locator('.research-card img').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  await page.screenshot({ path: join(screenshotDir, 'keyboard-research-mobile.png') });
  await page.goto(root);
  await button.click();
  await page.screenshot({ path: join(screenshotDir, 'mobile-menu.png') });
  report.interactions.push('Skip link and main focus', 'Keyboard menu open, tab sequence and Escape focus restoration', 'Mobile menu anchor navigation and close', 'Reduced-motion scroll and transition suppression');
  const pdf = await page.request.get(root + 'Yixuan_Zhuang_CV.pdf');
  assert.equal(pdf.status(), 200); assert.ok((await pdf.body()).subarray(0,5).toString() === '%PDF-');
  report.interactions.push('CV response is a real PDF');
  const missing = await page.goto(root + 'page-that-does-not-exist/');
  assert.equal(missing.status(), 404);
  assert.ok((await page.locator('h1').textContent()).includes('A different path'));
  report.interactions.push('Custom 404 returned with HTTP 404');
  for (const link of links) {
    const url = new URL(link);
    if (!['http:', 'https:'].includes(url.protocol)) continue;
    if (url.origin === new URL(root).origin) {
      const response = await page.request.get(url.href);
      assert.equal(response.status(), 200, `Internal ${url.href}`);
      if (url.hash) { const text = await response.text(); assert.ok(text.includes(`id="${url.hash.slice(1)}"`), `Fragment ${url}`); }
      report.internalLinks.push({ url: url.href, status: response.status() });
    } else report.externalLinks.push({ url: url.href, verification: 'See external-link-check.json and source audit' });
  }
  await page.close();
  report.errors = [...new Set(issues)];
  report.passed = !issues.length;
} catch (err) { report.errors = [...new Set([...issues, ...report.errors, err.stack])]; report.passed = false; }
finally { await browser.close(); await writeFile(join(reportDir, `browser-${new URL(root).pathname === '/' ? 'root' : 'project'}.json`), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: report.passed, pages: report.pages.length, interactions: report.interactions, internalLinks: report.internalLinks.length, errors: report.errors }, null, 2));
if (!report.passed) process.exitCode = 1;
