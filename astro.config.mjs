import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL || 'https://yixuanzhuang.com';
const base = `/${(process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
if (new URL(site).pathname !== '/') throw new Error('SITE_URL must be an origin; put the project path in BASE_PATH.');

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
});
