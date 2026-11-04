import { chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export function browserPath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const cache = join(process.env.LOCALAPPDATA, 'ms-playwright');
    if (existsSync(cache)) {
      for (const folder of readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
        const path = join(cache, folder, 'chrome-win64', 'chrome.exe');
        if (existsSync(path)) return path;
      }
    }
  }
  return chromium.executablePath();
}
export const launchBrowser = () => chromium.launch({ executablePath: browserPath(), headless: true });
