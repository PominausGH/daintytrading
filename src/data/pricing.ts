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
  carePlan: 290,
  fixDay: 1200,
  // AI engagements, quoted as "from" prices on a ~1,600 AUD/day internal basis. aiDiscovery
  // deliberately equals WiseKeel's Diagnostic (AU$4,500) so the two price lists never contradict.
  // Don't link the two sites: WiseKeel is kept as a standalone brand (Andrew's decision).
  aiDiscovery: 4500,
  aiRetrofitFrom: 24000,
  aiInfrastructureFrom: 28000,
  aiProductBuildFrom: 45000,
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
  carePlan: usdApprox(pricing.carePlan),
  fixDay: usdApprox(pricing.fixDay),
  // Set by hand, not by formula (which gives 2,800): Setup was priced as 4 fix days at
  // 1,000 minus a 100 bundle discount (3,900 AUD / 2,700 USD). Fix days rose to 1,200 on
  // 2026-10-15 but Setup stayed put, so it now beats fix days from about three days of work.
  // Don't "correct" this back to the formula.
  setupSingleTemplate: 2700,
  setupMultiTemplate: usdApprox(pricing.setupMultiTemplate),
  monitor: usdApprox(pricing.monitor),
  growth: usdApprox(pricing.growth),
  scale: usdApprox(pricing.scale),
  aiDiscovery: usdApprox(pricing.aiDiscovery),
  aiRetrofitFrom: usdApprox(pricing.aiRetrofitFrom),
  aiInfrastructureFrom: usdApprox(pricing.aiInfrastructureFrom),
  aiProductBuildFrom: usdApprox(pricing.aiProductBuildFrom),
} as const;

export function usd(n: number) {
  return `$${n.toLocaleString('en-US')}`;
}
