import { readFileSync } from 'node:fs';

// Single source of truth for prices reused across the services pages, pricing, homepage and the
// Cal.com description. Before this file existed, PR #14 (2026-09-02) had to hand-sync the same
// numbers across several pages — this is what makes a price change a one-line edit.
//
// USD is the source price (Andrew, 2026-10-20). AUD is derived from it with the live USD/AUD
// rate: AUD = USD x (AUD per 1 USD), rounded UP to the next $1, no buffer (Australian clients
// pay in AUD, so there is no conversion cost to cover). /opt/docker/scripts/fx-sync.sh fetches
// the ECB rate monthly into FX_RATES_FILE (only rewriting it on a >=2% move), and the host's
// dainty-deploy-build.sh rebuilds the site when the rate changes, so AUD prices move with it.
// To change a price, change the USD figure below. Never hand-type a price into page copy.

const FX_RATES_FILE = process.env.FX_RATES_FILE || '/opt/docker/shared/fx/fx-rates.json';
const FALLBACK_USD_TO_AUD = 1.437; // ECB 2026-10-16; used only if the rate file is missing (e.g. CI)

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

const audFromUsd = (usdAmount: number) => Math.ceil(usdAmount * fx.rate);
const usdFromAud = (audAmount: number) => Math.ceil(audAmount / fx.rate);

// The one AUD-fixed price: AI Discovery equals WiseKeel's Diagnostic (AU$4,500) so the two price
// lists never contradict; its USD is the live conversion. (WiseKeel briefly priced in USD from
// 2026-09-10; Andrew reverted it to AUD on 2026-10-20 and re-fixed this match.) Don't link the
// two sites: WiseKeel is kept as a standalone brand.
const AI_DISCOVERY_AUD = 4500;

// Source prices, USD. Care plan is 174 so it lands at ~A$250 (Andrew's Care plan price, 10-19).
// AI engagements are "from" prices.
export const pricingUsd = {
  // Smaller build tiers (Andrew approved 2026-10-22, after the iOnline teardown and AU market
  // research): a one-page landing page and a Starter site of up to 5 pages. Done for you on the
  // client's own hosting; not the retired self-serve BizPage Instant Page.
  landingPage: 900,
  starterSite: 2100,
  customBuild: 4950,
  carePlan: 174,
  fixDay: 850,
  // Flat hack/outage cleanup, up to 4 hours (see /support.html). Free on Care when the cause is
  // inside what Care covers; these apply otherwise. 313/522 USD = A$450/A$751 at 1.437.
  incidentRecovery: 313,
  incidentRecoveryNoPlan: 522,
  setupSingleTemplate: 2700,
  setupMultiTemplate: 5400,
  monitor: 300,
  growth: 700,
  scale: 1400,
  aiDiscovery: usdFromAud(AI_DISCOVERY_AUD),
  aiRetrofitFrom: 17300,
  aiInfrastructureFrom: 20200,
  aiProductBuildFrom: 32450,
} as const;

// GST: TelaLoom is not registered for GST (Andrew, 2026-10-22), so published prices carry no GST.
// When registering (turnover passes A$75k), set this to true: "No GST" copy disappears site-wide,
// and decide whether prices become GST-inclusive.
export const gstRegistered = false;

export const pricing = {
  audit: 'Free',
  currency: 'AUD',
  landingPage: audFromUsd(pricingUsd.landingPage),
  starterSite: audFromUsd(pricingUsd.starterSite),
  customBuild: audFromUsd(pricingUsd.customBuild),
  carePlan: audFromUsd(pricingUsd.carePlan),
  fixDay: audFromUsd(pricingUsd.fixDay),
  incidentRecovery: audFromUsd(pricingUsd.incidentRecovery),
  incidentRecoveryNoPlan: audFromUsd(pricingUsd.incidentRecoveryNoPlan),
  setupSingleTemplate: audFromUsd(pricingUsd.setupSingleTemplate),
  setupMultiTemplate: audFromUsd(pricingUsd.setupMultiTemplate),
  monitor: audFromUsd(pricingUsd.monitor),
  growth: audFromUsd(pricingUsd.growth),
  scale: audFromUsd(pricingUsd.scale),
  aiDiscovery: AI_DISCOVERY_AUD,
  aiRetrofitFrom: audFromUsd(pricingUsd.aiRetrofitFrom),
  aiInfrastructureFrom: audFromUsd(pricingUsd.aiInfrastructureFrom),
  aiProductBuildFrom: audFromUsd(pricingUsd.aiProductBuildFrom),
} as const;

export function aud(n: number) {
  return `$${n.toLocaleString('en-AU')}`;
}

export function usd(n: number) {
  return `$${n.toLocaleString('en-US')}`;
}
