# Yixuan Zhuang — Academic Website

A static Astro website presenting my research in computer architecture, AI accelerators, and design automation at Fudan University.

Use Node.js 24.15.0. Install dependencies with `npm ci`, then start local development with `npm run dev`.

Run `npm run check`, `npm run build`, and `npm run verify:build` before previewing with `npm run preview -- --port 4322`. The build check also verifies the published CV against its original SHA-256.

Research pages live in `src/content/research/`; profile, publications, and honors are in `src/data/`. Public assets and attribution files are in `public/`.

The About section includes a dated snapshot of my public Codex activity. Update its figures and snapshot month together in `profile.aiPractice` in `src/data/profile.ts`; the profile link leads to the latest activity.

For browser checks, install Chromium with `npx playwright install chromium`, keep the preview running, and run `npm run test:browser`. `TEST_URL` and `CHROME_PATH` can override the preview URL and browser executable.

The manually triggered GitHub Pages workflow builds for `https://yixuanzhuang.com/`. Asset credits and applicable third-party licenses are documented on the site's `/credits/` page and in `public/licenses/`.
