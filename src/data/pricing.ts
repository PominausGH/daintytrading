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

// Firm USD quoted pricing for the site's large US audience (Umami: ~10x more
// US than AU sessions on the commercial pages, 2026-09-28) — /usa.html
// promises "US clients invoice in USD, no currency conversion... on your
// end", so these are displayed as an equal, committed price alongside AUD,
// not a hedged "~approx" estimate. Derived from mid-market rate 0.70 (XE,
// 2026-09-28) plus a ~3% buffer to cover the cost of converting incoming USD
// back to AUD (Stripe's cross-border/currency-conversion fee runs ~2%) — the
// buffer is what makes committing to a firm number safe. Revisit this
// constant if AUD/USD moves materially; the buffer gives headroom before
// that's actually necessary. Figures round to the nearest $50 for clean,
// marketing-legible numbers rather than exact conversion precision.
const AUD_TO_USD_DISPLAY_RATE = 0.721;

function usdApprox(audAmount: number): number {
  return Math.round((audAmount * AUD_TO_USD_DISPLAY_RATE) / 50) * 50;
}

export const pricingUsd = {
  customBuild: usdApprox(pricing.customBuild),
  customBuildWithGrowthCommit: usdApprox(pricing.customBuildWithGrowthCommit),
  carePlan: usdApprox(pricing.carePlan),
  setupSingleTemplate: usdApprox(pricing.setupSingleTemplate),
  setupMultiTemplate: usdApprox(pricing.setupMultiTemplate),
  monitor: usdApprox(pricing.monitor),
  growth: usdApprox(pricing.growth),
  scale: usdApprox(pricing.scale),
} as const;

export function usd(n: number) {
  return `$${n.toLocaleString('en-US')}`;
}
