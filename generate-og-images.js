#!/usr/bin/env node
// Run once: node generate-og-images.js
// Outputs branded 1200x630 OG cards to ./og/[slug].png

const { createCanvas } = require('/tmp/node_modules/canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;
const OUT_DIR = path.join(__dirname, 'og');

const projects = [
  { slug: 'emailtriage',             name: 'Email Triage',             category: 'Productivity',   status: 'Live' },
  { slug: 'ghost-writer',            name: 'Ghost Writer',             category: 'Content',        status: 'Live' },
  { slug: 'subscription',            name: 'Subscription Incinerator', category: 'Productivity',   status: 'Live' },
  { slug: 'missed-calls',            name: 'Everyring.ai',             category: 'Business',       status: 'Live' },
  { slug: 'brightpath',              name: 'BrightPath',               category: 'Education',      status: 'Live' },
  { slug: 'cv-matcher',              name: 'CV Matcher',               category: 'Career',         status: 'Live' },
  { slug: 'bizpage-builder',         name: 'BizPage Builder',          category: 'Marketing',      status: 'Live' },
  { slug: 'focusguard',              name: 'FocusGuard',               category: 'Productivity',   status: 'Live' },
  { slug: 'autoarchive',             name: 'AutoArchive',              category: 'Email',          status: 'Live' },
  { slug: 'timerforge',              name: 'TimerForge',               category: 'Productivity',   status: 'Live' },
  { slug: 'emailcleanup',            name: 'Email Cleanup',            category: 'Email',          status: 'Live' },
  { slug: 'meditation',              name: 'Meditation',               category: 'Wellness',       status: 'In testing' },
  { slug: 'skeddy',                  name: 'Nudgle',                   category: 'Scheduling',     status: 'In testing' },
  { slug: 'marketing-os',            name: 'Marketing OS',             category: 'Marketing',      status: 'In testing' },
  { slug: 'chatvault',               name: 'ChatVault',                category: 'AI',             status: 'In testing' },
  { slug: 'tax-prep',                name: 'Tax Prep',                 category: 'Finance',        status: 'In testing' },
  { slug: 'second-brain',            name: 'Second Brain',             category: 'Knowledge',      status: 'In testing' },
  { slug: 'convoforge',              name: 'ConvoForge',               category: 'Communication',  status: 'In testing' },
  { slug: 'price-scout',             name: 'Price Scout',              category: 'Finance',        status: 'In testing' },
  { slug: 'auto-claude',             name: 'Auto-Claude',              category: 'AI Dev',         status: 'In testing' },
  { slug: 'fakecall',                name: 'FakeCall',                 category: 'Mobile',         status: 'In testing' },
  { slug: 'storypulse',              name: 'StoryPulse',               category: 'Social',         status: 'In development' },
  { slug: 'devtodo',                 name: 'DevTodo',                  category: 'Dev Tools',      status: 'In development' },
  { slug: 'chefforge',               name: 'ChefForge',                category: 'Food',           status: 'In development' },
  { slug: 'yoga-platform',           name: 'Yoga Platform',            category: 'Wellness',       status: 'In development' },
  { slug: 'billing-api',             name: 'Billing API',              category: 'Infrastructure', status: 'In development' },
  { slug: 'recipe-api',              name: 'Recipe API',               category: 'Infrastructure', status: 'In development' },
  { slug: 'screenshot-to-text',      name: 'Screenshot to Text',       category: 'Productivity',   status: 'In development' },
  { slug: 'receipt-bridge',          name: 'Receipt Bridge',           category: 'Finance',        status: 'In development' },
  { slug: 'prompt-builder',          name: 'Prompt Builder',           category: 'AI Dev',         status: 'In development' },
  { slug: 'finance-tracker',         name: 'Finance Tracker',          category: 'Finance',        status: 'In development' },
  { slug: 'banking-alerts',          name: 'Banking Alerts',           category: 'Finance',        status: 'In development' },
  { slug: 'telegram-crypto-sentiment', name: 'Telegram Crypto Sentiment', category: 'Crypto',     status: 'In development' },
  { slug: 'screenshoot-cleaner',     name: 'ScreenShoot Cleaner',      category: 'Productivity',   status: 'In development' },
  { slug: 'receiptsnap-ai',          name: 'ReceiptSnap AI',           category: 'Finance',        status: 'In development' },
];

const STATUS_COLORS = {
  'Live':           '#22c55e',
  'In testing':     '#f59e0b',
  'In development': '#7c5cff',
};

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const project of projects) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0c10';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Purple gradient overlay (top-right)
  const grad = ctx.createRadialGradient(WIDTH, 0, 0, WIDTH, 0, 600);
  grad.addColorStop(0, 'rgba(124,92,255,0.22)');
  grad.addColorStop(1, 'rgba(124,92,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Left accent bar
  ctx.fillStyle = '#7c5cff';
  ctx.fillRect(60, 80, 4, HEIGHT - 160);

  // Category pill
  const pillX = 84;
  const pillY = 90;
  ctx.font = 'bold 18px sans-serif';
  const catW = ctx.measureText(project.category).width + 28;
  ctx.fillStyle = 'rgba(124,92,255,0.25)';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, catW, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#a78bfa';
  ctx.fillText(project.category, pillX + 14, pillY + 22);

  // Status badge
  const statusColor = STATUS_COLORS[project.status] || '#7c5cff';
  const badgeX = pillX + catW + 12;
  ctx.font = 'bold 18px sans-serif';
  const badgeW = ctx.measureText(project.status).width + 28;
  ctx.fillStyle = statusColor + '30';
  ctx.beginPath();
  ctx.roundRect(badgeX, pillY, badgeW, 34, 8);
  ctx.fill();
  ctx.fillStyle = statusColor;
  ctx.fillText(project.status, badgeX + 14, pillY + 22);

  // Project name (large)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px sans-serif';
  wrapText(ctx, project.name, 84, 220, WIDTH - 140, 86);

  // Tagline
  ctx.fillStyle = '#8b92a5';
  ctx.font = '26px sans-serif';
  ctx.fillText('An AI automation product by Dainty Trading', 84, 420);

  // Bottom divider
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(60, HEIGHT - 100, WIDTH - 120, 1);

  // Brand mark (simple diamond)
  const bx = 84, by = HEIGHT - 72;
  ctx.fillStyle = '#7c5cff';
  ctx.beginPath();
  ctx.moveTo(bx + 10, by);
  ctx.lineTo(bx + 20, by + 10);
  ctx.lineTo(bx + 10, by + 20);
  ctx.lineTo(bx, by + 10);
  ctx.closePath();
  ctx.fill();

  // Brand name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Dainty Trading', bx + 28, by + 15);

  // URL
  ctx.fillStyle = '#8b92a5';
  ctx.font = '20px sans-serif';
  ctx.fillText('daintytrading.com', WIDTH - 60 - ctx.measureText('daintytrading.com').width, by + 15);

  const outPath = path.join(OUT_DIR, `${project.slug}.png`);
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buf);
  console.log(`  ✓ ${project.slug}.png`);
}

console.log(`\nGenerated ${projects.length} OG images in ./og/`);
