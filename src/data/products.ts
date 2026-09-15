// Single source of truth for the portfolio counts quoted on index/about/australia/usa/uk/work.
// Before this existed, "37 products" and "17 live and paying" were hand-typed into 6 pages —
// PR #50 (2026-09-15) fixed one drift (37 vs the real 38) but the fix itself was still
// hardcoded numbers, so the same drift could happen again. Every product's true status now
// lives once, in that product's own content-collection frontmatter (`status:` in its .md file);
// this file just counts it.
import { getCollection } from 'astro:content';

export async function getProductCounts() {
  const entries = await getCollection('projects', ({ data }) => data.type === 'product');
  const live = entries.filter((e) => e.data.status === 'live').length;
  const testing = entries.filter((e) => e.data.status === 'testing').length;
  const dev = entries.filter((e) => e.data.status === 'dev').length;
  return { total: entries.length, live, testing, dev };
}
