import { readFile, mkdir } from 'node:fs/promises';
import { launchBrowser } from './browser-utils.mjs';
import { profile } from '../src/data/profile.ts';
const uri = async (path, type) => `data:${type};base64,${(await readFile(path)).toString('base64')}`;
const image = await uri('public/images/hero/wafer.webp', 'image/webp');
const font = await uri('node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2', 'font/woff2');
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Newsreader;src:url('${font}')}*{box-sizing:border-box}body{margin:0;background:#09131d;color:#f3f1ed;font-family:Newsreader}img{position:absolute;width:100%;height:100%;object-fit:cover;object-position:45% center}main{position:absolute;inset:0;padding:76px 68px;background:linear-gradient(90deg,#071119eb 5%,#071119b0 40%,#07111910 82%)}.label{font:13px Arial;letter-spacing:3px;text-transform:uppercase;color:#dcc398}h1{font-size:76px;font-weight:400;margin:83px 0 24px;letter-spacing:-1px}.desc{font-size:29px;line-height:1.35;max-width:610px;margin:0}.foot{margin-top:65px;font-size:20px;color:#e5d3ae}</style></head><body><img src="${image}" alt=""><main><div class="label">Undergraduate Student · Fudan University</div><h1>${profile.name}</h1><p class="desc">${profile.description}</p><div class="foot">Computer Architecture &nbsp; / &nbsp; Design Automation</div></main></body></html>`);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
  await mkdir('public/images/social', { recursive: true });
  await page.screenshot({ path: 'public/images/social/og.png' });
  console.log('Created 1200×630 social preview from local original assets.');
} finally { await browser.close(); }
