import type { APIRoute } from 'astro';
import { pricing, aud } from '../../data/pricing';
import { getProductCounts } from '../../data/products';

// Build-time artifact consumed by scripts/sync-calcom-description.js after
// `npm run build`, to push this exact text into Cal.com's EventType.description
// (id 1156, slug "daintytrading") so pricing/product-count copy only has to be
// edited once, in pricing.ts/products.ts, instead of also by hand in Cal.com's
// dashboard. Not linked from anywhere — blocked from public access by the
// existing `location ~ ^/api/.*\.(js|mjs|json|...)$` deny rule in nginx.conf.
export const GET: APIRoute = async () => {
  const { total } = await getProductCounts();

  const description =
    `Dainty Trading — AI Automation Studio. We design, build & operate production AI software, ` +
    `first demo to paying customers in weeks. ${total} products shipped.<br>` +
    `🔹 AI Product Builds — concept to paying product, 6–12 weeks<br>` +
    `🔹 Automation Retrofits — bolt AI into your SaaS, 2–6 weeks<br>` +
    `🔹 AI Infrastructure — LLM gateways, evals, billing, observability<br>` +
    `🔹 SEO & GEO — rank on Google AND get cited by ChatGPT/Claude/Perplexity. ` +
    `Free audit, setup from ${aud(pricing.setupSingleTemplate)}<br>` +
    `🔹 Websites — from $${pricing.instantPageFromUsd} instant page from Google business, ` +
    `or ${aud(pricing.customBuild)} custom with SEO/GEO Async-first: daily updates, weekly demos. ` +
    `A few clients per quarter, so every project gets real attention.<br>`;

  return new Response(
    JSON.stringify({ description, productTotal: total, generatedAt: new Date().toISOString() }, null, 2),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
