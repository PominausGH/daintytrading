import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Borrow a Playwright install from the host (PLAYWRIGHT_MODULE overrides); same loader as scripts/showcase-capture.mjs.
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
// Pinned browser revision may not be installed; fall back to the newest shared headless shell.
function executablePath(chromium) {
  if (existsSync(chromium.executablePath())) return undefined;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/ms-playwright';
  const shells = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort() : [];
  if (!shells.length) return undefined;
  return join(base, shells.at(-1), 'chrome-headless-shell-linux64', 'chrome-headless-shell');
}
const chromium = await loadChromium();

const sites = [
  { slug: 'autoarchive',      url: 'https://autoarchivemail.com' },
  { slug: 'bizpage-builder',  url: 'https://bizpage.biz' },
  { slug: 'brightpath',       url: 'https://brightpath.school' },
  { slug: 'convoforge',       url: 'https://convoforge.app' },
  { slug: 'cv-matcher',       url: 'https://cvmatcher.work' },
  { slug: 'emailtriage',      url: 'https://email-triage.app' },
  { slug: 'focusguard',       url: 'https://focusshield.app' },
  { slug: 'ghost-writer',     url: 'https://signalreads.com' },
  { slug: 'missed-calls',     url: 'https://everyring.ai' },
  { slug: 'skeddy',           url: 'https://reminder.signalreads.com' },
  { slug: 'subscription',     url: 'https://subscriptionincinerator.app' },
  { slug: 'timerforge',       url: 'https://timerforge.app' },
];

const outDir = join(__dirname, 'projects', 'screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: executablePath(chromium), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});

for (const { slug, url } of sites) {
  const page = await context.newPage();
  try {
    console.log(`Screenshotting ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    // Dismiss cookie banners / overlays if present
    await page.waitForTimeout(1500);
    const outPath = join(outDir, `${slug}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    console.log(`  ✓ saved ${slug}.png`);
  } catch (err) {
    console.error(`  ✗ ${slug}: ${err.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log('\nDone.');
