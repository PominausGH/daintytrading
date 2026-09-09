// Single source of truth for prices reused across services/seo-geo-optimization.astro,
// services/local-seo.astro, and services/website-builds.astro. Before this file existed,
// PR #14 (2026-09-02) had to hand-sync these same numbers across those 3 pages plus
// index.html/services.html — this is what makes that a one-line change instead.
export const pricing = {
  audit: 'Free',
  setupSingleTemplate: 3900,
  setupMultiTemplate: 7500,
  monitor: 450,
  growth: 950,
  scale: 1950,
  currency: 'AUD',
  instantPageFromUsd: 149,
  instantPageHostedFromUsd: 39,
  instantPageOwnDomainFromUsd: 79,
  customBuild: 6900,
  customBuildWithGrowthCommit: 4900,
  carePlan: 290,
} as const;

export function aud(n: number) {
  return `$${n.toLocaleString('en-AU')}`;
}
