import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { basename, extname, join, relative } from 'node:path';
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const approvedCvHash = 'c3cae4ddcfc4f4880a103aefb8c8458632845aaea4ad4c7118ea381adbb02524';
assert.equal(await hash('public/Yixuan_Zhuang_CV.pdf'), approvedCvHash, 'The public CV must match the approved original SHA-256');
assert.equal(await hash('dist/Yixuan_Zhuang_CV.pdf'), approvedCvHash, 'The built CV must match the approved original SHA-256');
const base = `/${(process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
const site = new URL(process.env.SITE_URL || 'https://yixuanzhuang.com').origin;
const paths = ['', 'research/accelerator/', 'research/gpu-simulation/', 'research/model2gds/', 'credits/'];
const pages = [];
for (const path of paths) {
  const html = await readFile(join('dist', path, 'index.html'), 'utf8');
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `Single h1: ${path}`);
  assert.ok(html.includes(`rel="canonical" href="${site}${base}${path}"`), `Canonical: ${path}`);
  assert.ok(html.includes(`${base}images/social/og.png`), `OG path: ${path}`);
  assert.ok(!/href="#"(?:\s|>)/.test(html), `No dummy links: ${path}`);
  const urls = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(url => url.startsWith('/'));
  for (const url of urls) assert.ok(url.startsWith(base), `Base path: ${url}`);
  pages.push({ path, singleH1: true, canonical: `${site}${base}${path}`, basePaths: true });
}
assert.ok((await readFile('dist/robots.txt', 'utf8')).includes(`${site}${base}sitemap.xml`));
assert.ok((await stat('dist/images/social/og.png')).size > 0);
assert.ok((await readFile('dist/404.html', 'utf8')).includes('noindex'));
const files = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async entry => {
  assert.ok(!entry.isSymbolicLink(), 'Build output must not contain symlinks to other local material');
  return entry.isDirectory() ? files(join(dir, entry.name)) : entry.isFile() ? [join(dir, entry.name)] : [];
}))).flat();
const output = await files('dist');
const outputPaths = output.map(file => relative('dist', file).replaceAll('\\', '/'));
const forbiddenSegments = /(^|\/)(?:_codex_materials|awards_private|academic_sources_private|reference_only|design_reference|node_modules|artifacts|references|docs|src|\.git|\.github|\.astro)(?:\/|$)/i;
const inputBundle = /(^|\/)Yixuan_Website_V1_DropIn_Resources[^/]*(?:\/|$)/i;
const privateOrInternalName = /^(?:README_FIRST|FINAL_INTEGRATION_INSTRUCTIONS|CODEX_EXECUTION_PROMPT|CONTENT_FACTS_AND_COPY|START_HERE|DOCUMENTATION_LINKS|AGENTS|Yixuan_Website_V1_Refinement_Codex_Prompt)\.md$|APPROVED_HOMEPAGE_REFERENCE|approved_homepage_reference|CV_ORIGINAL|Original_English_CV_Do_Not_Edit|^\.env(?:\.|$)|^\.gitignore$|^package(?:-lock)?\.json$/i;
const nonWebSources = /\.(?:astro|ts|tsx|jsx|zip|7z|rar|tar|tgz|docx?|pptx?|pem|key)$/i;
const forbiddenPaths = outputPaths.filter(path => forbiddenSegments.test(path) || inputBundle.test(path) || privateOrInternalName.test(basename(path)) || nonWebSources.test(path) || (/\.md$/i.test(path) && !path.startsWith('licenses/')));
assert.equal(forbiddenPaths.length, 0, 'Build must exclude all material-input folders, nested extraction bundles, private/source documents, archives, and internal instructions');

// Locate private comparison inputs without exposing their names or contents in reports.
// Selected public research PNGs and the approved photo/award preview are deliberately
// outside these private buckets and are not blanket-blocked by their input origin.
const materialRoots = [];
const discoverySkip = new Set(['node_modules', '.git', '.astro', '.cache', 'dist', 'public', 'artifacts', 'references']);
async function discoverMaterials(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || discoverySkip.has(entry.name)) continue;
    const child = join(dir, entry.name);
    if (entry.name.toLowerCase() === '_codex_materials') materialRoots.push(child);
    else await discoverMaterials(child);
  }
}
await discoverMaterials(process.cwd());
const privateDigests = new Set();
const privateSourceCounts = { awards_private: 0, academic_sources_private: 0 };
for (const materialRoot of materialRoots) {
  for (const category of Object.keys(privateSourceCounts)) {
    const sourceDir = join(materialRoot, category);
    let sourceFiles = [];
    try { sourceFiles = await files(sourceDir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    privateSourceCounts[category] += sourceFiles.length;
    for (const file of sourceFiles) privateDigests.add(await hash(file));
  }
}
const binaryChecks = await Promise.all(output.map(async (file, index) => {
  const buffer = await readFile(file);
  const digest = createHash('sha256').update(buffer).digest('hex');
  const isPdf = extname(file).toLowerCase() === '.pdf' || buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'));
  const textLike = /\.(?:html?|css|m?js|json|txt|xml|svg|md)$/i.test(file);
  const containsInputMarker = textLike && /_codex_materials|awards_private|academic_sources_private|Yixuan_Website_V1_DropIn_Resources|README_FIRST\.md|FINAL_INTEGRATION_INSTRUCTIONS\.md/i.test(buffer.toString('utf8'));
  return { path: outputPaths[index], isPdf, privateMatch: privateDigests.has(digest), containsInputMarker, bytes: buffer.length };
}));
assert.deepEqual(binaryChecks.filter(file => file.isPdf).map(file => file.path), ['Yixuan_Zhuang_CV.pdf'], 'The unchanged approved CV must be the only PDF in public output, including files renamed to another extension');
assert.equal(binaryChecks.filter(file => file.privateMatch).length, 0, 'A build file matches a private certificate or academic source input byte-for-byte');
assert.equal(binaryChecks.filter(file => file.containsInputMarker).length, 0, 'Published text must not expose internal input paths or integration instructions');
const privacy = {
  approvedCvHashPinned: true, onlyPdf: 'Yixuan_Zhuang_CV.pdf',
  forbiddenInputPaths: 0, internalSourceMarkers: 0, privateByteMatches: 0,
  localMaterialRootsFound: materialRoots.length, privateSourceCounts,
  privateHashComparison: materialRoots.length ? 'Completed for the local private buckets' : 'Local inputs absent; filename, content-marker, PDF and pinned-CV checks still applied',
  scope: 'Path/signature checks and exact-byte comparisons; selected public PNGs remain allowed. Visible personal details in transformed images still require editorial review.',
};
const report = { checkedAt: new Date().toISOString(), passed: true, base, site, cvSHA256: approvedCvHash, privacy, pages, files: output.length, bytes: binaryChecks.reduce((total, file) => total + file.bytes, 0) };
const reportDirectory = process.env.QA_ARTIFACT_DIR ? join(process.env.QA_ARTIFACT_DIR, 'reports') : 'artifacts/reports';
await mkdir(reportDirectory, { recursive: true });
await writeFile(join(reportDirectory, `build${base === '/' ? '-root' : '-project'}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
