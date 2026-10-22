#!/usr/bin/env node
// IndexNow: tell Bing (and the other IndexNow engines) which pages changed after a deploy, so
// they are re-crawled in minutes instead of weeks. Bing's index feeds Copilot and much of
// ChatGPT search. Runs from the host deploy script after a successful build.
//
//   node scripts/indexnow-submit.mjs [--dist dist] [--site https://telaloom.com]
//        [--key <hex>] [--state <file>] [--dry-run]
//
// How it works: reads <dist>/sitemap.xml, hashes each page's built HTML, and submits only URLs
// whose hash changed since the last successful submit (plus URLs that disappeared, so engines
// re-crawl them and drop them). State lives OUTSIDE the repo (default
// /opt/docker/backups/logs/indexnow-<host>.json) so the deploy's dirty-tree guard never trips.
// It refuses to submit until https://<site>/<key>.txt serves the key, so it is safe to merge
// before the key file is live. Reusable for client static builds: pass --dist/--site/--key and
// publish <key>.txt at that site's root. The key is public by design (IndexNow verifies
// ownership by fetching it), so it is not a secret.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DEFAULT_KEY = 'b89eef1590ec7aa698f398a3ac89b794'; // telaloom.com; file: public/<key>.txt
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000; // IndexNow limit per request

function args(argv) {
  const out = { dist: 'dist', site: 'https://telaloom.com', key: DEFAULT_KEY, state: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (['--dist', '--site', '--key', '--state'].includes(a)) out[a.slice(2)] = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  out.site = out.site.replace(/\/+$/, '');
  out.host = new URL(out.site).host;
  out.state ||= `/opt/docker/backups/logs/indexnow-${out.host}.json`;
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(out.key)) throw new Error('key must be 8-128 chars of a-z, A-Z, 0-9 or -');
  return out;
}

// Sitemap URL -> built file. Astro builds /x.html as dist/x.html and / as dist/index.html.
export function fileFor(dist, site, url) {
  let p = url.startsWith(site) ? url.slice(site.length) : new URL(url).pathname;
  p = p.split('#')[0].split('?')[0] || '/';
  if (p.endsWith('/')) p += 'index.html';
  else if (!/\.[a-z0-9]+$/i.test(p)) p += '.html';
  return join(dist, decodeURIComponent(p));
}

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

// Changed or new URLs, plus URLs that were in the last state but are gone now.
export function diff(prev, next) {
  const changed = Object.keys(next).filter((u) => prev[u] !== next[u]);
  const removed = Object.keys(prev).filter((u) => !(u in next));
  return [...changed, ...removed];
}

async function keyIsLive(site, key) {
  try {
    const r = await fetch(`${site}/${key}.txt`, { headers: { 'User-Agent': 'telaloom-indexnow/1' } });
    return r.ok && (await r.text()).trim() === key;
  } catch {
    return false;
  }
}

async function main() {
  const o = args(process.argv.slice(2));
  const sm = join(o.dist, 'sitemap.xml');
  if (!existsSync(sm)) throw new Error(`no sitemap at ${sm}`);
  const next = {};
  for (const url of sitemapUrls(readFileSync(sm, 'utf8'))) {
    const f = fileFor(o.dist, o.site, url);
    if (!existsSync(f)) continue; // in the sitemap but not built here; leave it out
    next[url] = createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
  }
  const prev = existsSync(o.state) ? JSON.parse(readFileSync(o.state, 'utf8')) : {};
  const urls = diff(prev, next);
  const tag = `[indexnow ${o.host}]`;
  if (!urls.length) return console.log(`${tag} nothing changed (${Object.keys(next).length} pages)`);
  if (o.dryRun) {
    console.log(`${tag} dry run: would submit ${urls.length} of ${Object.keys(next).length} pages`);
    urls.slice(0, 20).forEach((u) => console.log('  ' + u));
    return;
  }
  if (!(await keyIsLive(o.site, o.key))) {
    return console.log(`${tag} key file ${o.site}/${o.key}.txt not live yet; skipping (will retry next deploy)`);
  }
  for (let i = 0; i < urls.length; i += MAX_URLS) {
    const urlList = urls.slice(i, i + MAX_URLS);
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'telaloom-indexnow/1' },
      body: JSON.stringify({ host: o.host, key: o.key, keyLocation: `${o.site}/${o.key}.txt`, urlList }),
    });
    // 200 OK and 202 Accepted both mean received; anything else, keep the old state and retry next time.
    if (r.status !== 200 && r.status !== 202) {
      console.log(`${tag} submit failed: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      process.exitCode = 1;
      return;
    }
  }
  mkdirSync(dirname(o.state), { recursive: true });
  writeFileSync(o.state, JSON.stringify(next, null, 0));
  console.log(`${tag} submitted ${urls.length} URL(s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.log(`[indexnow] error: ${e.message}`);
    process.exitCode = 1;
  });
}
