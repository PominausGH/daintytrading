import { chromium } from '/root/.nvm/versions/node/v22.18.0/lib/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
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
