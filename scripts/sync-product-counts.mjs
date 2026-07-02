#!/usr/bin/env node
// Single source of truth for product counts = the actual project cards in
// index.html's #projects section. Run this after adding/moving/removing a
// project card, and it rewrites every other count (hero, trust stat, FAQ
// copy, FAQ JSON-LD, llms.txt) to match. Prevents the count drift that
// otherwise creeps in every time a product ships or moves stage.
//
// Usage: node scripts/sync-product-counts.mjs [--check]
//   --check   exit 1 if any file would change, without writing (for CI/pre-commit)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checkOnly = process.argv.includes('--check');

const indexPath = join(root, 'index.html');
const llmsPath = join(root, 'llms.txt');

let index = readFileSync(indexPath, 'utf8');
const llms = readFileSync(llmsPath, 'utf8');

// --- 1. Derive ground truth from the #projects section markup ---
const projectsSection = index.match(/<section id="projects">[\s\S]*?<\/section>/);
if (!projectsSection) throw new Error('Could not find <section id="projects"> in index.html');

const groupRe = /<h3 class="group-heading (group-live|group-test|group-dev)">[\s\S]*?<span class="group-count">(\d+) products<\/span>[\s\S]*?<\/h3>\s*<div class="project-grid">([\s\S]*?)<\/div>\s*<\/div>/g;

const counts = { 'group-live': 0, 'group-test': 0, 'group-dev': 0 };
let match;
let rewritten = projectsSection[0];
while ((match = groupRe.exec(projectsSection[0])) !== null) {
  const [full, groupClass, , cardsBlock] = match;
  const actual = (cardsBlock.match(/<a class="project-card"/g) || []).length;
  counts[groupClass] = actual;
  const fixed = full.replace(/<span class="group-count">\d+ products<\/span>/, `<span class="group-count">${actual} products</span>`);
  rewritten = rewritten.replace(full, fixed);
}

const live = counts['group-live'];
const testing = counts['group-test'];
const dev = counts['group-dev'];
const total = live + testing + dev;

if (!live || !testing || !dev) {
  throw new Error(`Failed to parse one or more groups (live=${live}, testing=${testing}, dev=${dev}) — check index.html markup hasn't changed shape.`);
}

index = index.replace(projectsSection[0], rewritten);

// --- 2. Propagate total/live counts through index.html ---
const indexReplacements = [
  [/AI Automation Studio · \d+ Products/, `AI Automation Studio · ${total} Products`],
  [/We&rsquo;ve built \d+ products ourselves/, `We&rsquo;ve built ${total} products ourselves`],
  [/(<div class="stat-num">)\d+(<\/div>\s*<div class="stat-label">Products shipped)/, `$1${total}$2`],
  [/We have \d+ products &mdash; \d+ live and paying/, `We have ${total} products &mdash; ${live} live and paying`],
  [/<h2>\d+ AI Products Built and Running<\/h2>/, `<h2>${total} AI Products Built and Running</h2>`],
  [/— \d+ products covering email, content, education/, `— ${total} products covering email, content, education`],
  [/"description": "\d+ products built and operated by Dainty Trading/, `"description": "${total} products built and operated by Dainty Trading`],
  [/— \d+ live products shipped\. We take client engagements/, `— ${live} live products shipped. We take client engagements`],
  [/Dainty Trading has \d+ live products as proof of delivery/, `Dainty Trading has ${live} live products as proof of delivery`],
  [/AI Automation Studio \| \d+ Products Shipped/, `AI Automation Studio | ${total} Products Shipped`],
];

for (const [pattern, replacement] of indexReplacements) {
  if (!pattern.test(index)) {
    console.warn(`Warning: pattern not found in index.html: ${pattern}`);
    continue;
  }
  index = index.replace(pattern, replacement);
}

// --- 3. Propagate through llms.txt ---
let newLlms = llms
  .replace(/— \d+ products in our portfolio/, `— ${total} products in our portfolio`)
  .replace(/our own portfolio \(\d+ products\)/, `our own portfolio (${total} products)`)
  .replace(/AI automation studio with \d+ products/, `AI automation studio with ${total} products`);

// --- 4. Write or check ---
const changed = index !== readFileSync(indexPath, 'utf8') || newLlms !== llms;

if (checkOnly) {
  if (changed) {
    console.error('Product counts are out of sync. Run `node scripts/sync-product-counts.mjs` to fix.');
    process.exit(1);
  }
  console.log(`OK — counts in sync (${total} total: ${live} live, ${testing} testing, ${dev} dev).`);
  process.exit(0);
}

writeFileSync(indexPath, index);
writeFileSync(llmsPath, newLlms);
console.log(`Synced counts: ${total} total (${live} live, ${testing} testing, ${dev} dev).`);
console.log('Note: llms.txt product *lists* (which products appear under which heading) are not auto-generated — add new products there by hand, this script only fixes numbers.');
