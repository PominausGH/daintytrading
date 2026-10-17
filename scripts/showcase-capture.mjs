// Screenshots for the client-site carousel (src/components/ClientShowcase.astro).
//
//   node scripts/showcase-capture.mjs <slug>              # at go-live: shoots the LIVE domain
//   node scripts/showcase-capture.mjs <slug> --url <url>  # local preview only (staging); don't commit those images
//
// Writes public/screenshots/clients/showcase/<slug>-after.jpg (1440x900), <slug>-after-mobile.jpg
// (390x844 @2x) and, for redesigns, <slug>-before.jpg converted from the pre-cutover capture in
// /opt/docker/client-portfolio-assets/before/ (kept out of the repo until the client is live).
// Look at the images before committing: cookie banners or popups on the live site end up in the shot.
import { readFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BEFORE_DIR = '/opt/docker/client-portfolio-assets/before';
const outDir = join(root, 'public/screenshots/clients/showcase');

const [slug, flag, override] = process.argv.slice(2);
const { clients } = JSON.parse(readFileSync(join(root, 'src/data/client-showcase.json'), 'utf8'));
const client = clients.find((c) => c.slug === slug);
if (!client) {
  console.error(`Unknown slug "${slug}". One of: ${clients.map((c) => c.slug).join(', ')}`);
  process.exit(1);
}
const url = flag === '--url' && override ? override : client.url;
mkdirSync(outDir, { recursive: true });

// This repo doesn't depend on Playwright; borrow an install from the host (PLAYWRIGHT_MODULE overrides).
async function loadChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    '/opt/docker/ghost_writer/node_modules/playwright/index.mjs',
    '/root/.nvm/versions/node/v22.18.0/lib/node_modules/playwright/index.mjs',
  ].filter(Boolean);
  for (const c of candidates) {
    try { return (await import(c)).chromium; } catch {}
  }
  throw new Error('No Playwright found. Set PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs');
}
// Its pinned browser revision may not be installed; fall back to the newest shared headless shell.
function executablePath(chromium) {
  if (existsSync(chromium.executablePath())) return undefined;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/ms-playwright';
  const shells = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort() : [];
  if (!shells.length) return undefined;
  return join(base, shells.at(-1), 'chrome-headless-shell-linux64', 'chrome-headless-shell');
}
const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: executablePath(chromium), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  for (const [name, viewport, deviceScaleFactor] of [
    ['after', { width: 1440, height: 900 }, 1],
    ['after-mobile', { width: 390, height: 844 }, 2],
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500); // let hero animations settle
    const file = join(outDir, `${slug}-${name}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
    console.log('wrote', file, 'from', url);
    await page.close();
  }

  if (client.kind === 'redesign') {
    const src = join(BEFORE_DIR, client.beforeSource);
    if (!existsSync(src)) throw new Error(`before image not found: ${src}`);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const b64 = readFileSync(src).toString('base64');
    await page.setContent(`<body style="margin:0"><img style="display:block;width:1440px;height:900px" src="data:image/png;base64,${b64}"></body>`);
    const file = join(outDir, `${slug}-before.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
    console.log('wrote', file, 'from', src);
    await page.close();
  }
} finally {
  await browser.close();
}
if (url !== client.url) console.log('\nPreview capture from', url, '- do not commit these images.');
else console.log(`\nNext: check the images, set "live": true for ${slug} in src/data/client-showcase.json, npm run build, PR.`);
