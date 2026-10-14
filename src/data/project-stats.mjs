// Single build-time source for client traffic numbers quoted on the site.
//
// api/scripts/update-project-view-stats.py (weekly cron) writes real Umami
// numbers to api/data/project-stats.json, which is gitignored but present on
// the host that runs `astro build`. Every page that quotes one of these numbers
// renders it through here (Stat.astro, statTokensToHtml, or the rehype plugin in
// astro.config.mjs for markdown) so the static HTML carries one value everywhere,
// and public/js/shuttersmith-stats.js refreshes the same [data-stat] nodes at
// runtime. Never hard-code the number in a page: a literal can't be refreshed
// and ends up contradicting the hydrated ones (405 vs 686 on the homepage,
// 2026-10-14).
//
// Plain .mjs (not .ts) so astro.config.mjs can import it too.
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const FALLBACK_FILE = path.join(DATA_DIR, 'project-stats.fallback.json');
const LIVE_FILE = path.join(process.cwd(), 'api', 'data', 'project-stats.json');

let cached;

export function getProjectStats() {
  if (cached) return cached;
  const fallback = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf8'));
  let live = {};
  try {
    live = JSON.parse(fs.readFileSync(LIVE_FILE, 'utf8'));
  } catch {
    console.warn(`[project-stats] ${LIVE_FILE} not readable, baking the committed fallback numbers`);
  }
  cached = { ...fallback, ...live };
  return cached;
}

// 'shuttersmith.visits' -> '686'. Throws on an unknown key so a typo fails the
// build instead of shipping an empty number.
export function statText(key) {
  const [project, field] = key.split('.');
  const value = getProjectStats()[project]?.[field];
  if (value == null) throw new Error(`[project-stats] unknown stat "${key}"`);
  return typeof value === 'number' ? value.toLocaleString('en-AU') : String(value);
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const statSpan = (key) => `<span data-stat="${key}">${escapeHtml(statText(key))}</span>`;

// Markdown and frontmatter can't call a component, so they write {{stat:shuttersmith.visits}}.
export const STAT_TOKEN = /\{\{stat:([a-zA-Z0-9]+\.[a-zA-Z0-9]+)\}\}/g;

// For plain-text strings (frontmatter values): escapes the text, expands tokens. Use with set:html.
export function statTokensToHtml(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(STAT_TOKEN)) {
    out += escapeHtml(text.slice(last, m.index)) + statSpan(m[1]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

// Rehype plugin for markdown bodies. Runs before Astro's rehype-raw, so inline
// HTML is still `raw` nodes (already HTML: expand in place) and markdown text is
// `text` nodes (escape, then expand, and hand over as raw).
export function rehypeStatTokens() {
  const walk = (node) => {
    if (typeof node.value === 'string' && node.value.includes('{{stat:')) {
      if (node.type === 'raw') {
        node.value = node.value.replace(STAT_TOKEN, (_m, key) => statSpan(key));
      } else if (node.type === 'text') {
        node.type = 'raw';
        node.value = statTokensToHtml(node.value);
      }
    }
    (node.children || []).forEach(walk);
  };
  return walk;
}
