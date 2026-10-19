import { readFileSync } from 'node:fs';

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
  customBuild: 6900,
  carePlan: 250,
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

// USD pricing for the site's large US audience (Umami: ~10x more US than AU sessions on the
// commercial pages, 2026-09-28). /usa.html promises US clients are invoiced in USD, so these
// are shown as real prices alongside AUD, not hedged estimates.
//
// Derived from the live AUD/USD rate (Andrew, 2026-10-20): /opt/docker/scripts/fx-sync.sh
// fetches the ECB rate monthly into FX_RATES_FILE, and dainty-deploy-build.sh rebuilds the
// site when that file changes. Each AUD price x mid-rate x 1.03 (covers Stripe's ~2%
// cross-border/conversion cost of turning USD back into AUD), rounded UP to the next $1.
// The AUD price is the source of truth; nothing here is hand-set.
const FX_RATES_FILE = process.env.FX_RATES_FILE || '/opt/docker/shared/fx/fx-rates.json';
const FALLBACK_USD_TO_AUD = 1.437; // ECB 2026-10-16; used only if the rate file is missing (e.g. CI)
const CONVERSION_BUFFER = 1.03;

function readUsdToAud(): { rate: number; date: string | null } {
  try {
    const j = JSON.parse(readFileSync(FX_RATES_FILE, 'utf8'));
    const rate = Number(j?.usd?.AUD);
    if (rate > 1 && rate < 2.5) return { rate, date: j.rate_date ?? null };
  } catch {
    // fall through to the fallback below
  }
  return { rate: FALLBACK_USD_TO_AUD, date: null };
}

export const fx = readUsdToAud(); // { rate: AUD per 1 USD, date: ECB rate date or null on fallback }

function usdFromAud(audAmount: number): number {
  return Math.ceil((audAmount / fx.rate) * CONVERSION_BUFFER);
}

export const pricingUsd = {
  customBuild: usdFromAud(pricing.customBuild),
  carePlan: usdFromAud(pricing.carePlan),
  fixDay: usdFromAud(pricing.fixDay),
  setupSingleTemplate: usdFromAud(pricing.setupSingleTemplate),
  setupMultiTemplate: usdFromAud(pricing.setupMultiTemplate),
  monitor: usdFromAud(pricing.monitor),
  growth: usdFromAud(pricing.growth),
  scale: usdFromAud(pricing.scale),
  aiDiscovery: usdFromAud(pricing.aiDiscovery),
  aiRetrofitFrom: usdFromAud(pricing.aiRetrofitFrom),
  aiInfrastructureFrom: usdFromAud(pricing.aiInfrastructureFrom),
  aiProductBuildFrom: usdFromAud(pricing.aiProductBuildFrom),
} as const;

export function usd(n: number) {
  return `$${n.toLocaleString('en-US')}`;
}
