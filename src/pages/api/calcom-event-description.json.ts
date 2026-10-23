import type { APIRoute } from 'astro';
import { pricing, aud, gstRegistered } from '../../data/pricing';

// Build-time artifact consumed by scripts/sync-calcom-description.js after
// `npm run build`, to push this exact text into Cal.com's EventType.description
// (id 1156, slug "telaloom", the cal.daintytrading.com/andrewdainty/telaloom booking page)
// so prices only have to be edited once, in pricing.ts, instead of also by hand in Cal.com's
// dashboard. Web-first like the homepage (Andrew, 2026-10-22): websites and Local SEO & GEO
// lead, AI comes last. Not linked from anywhere — blocked from public access by the
// existing `location ~ ^/api/.*\.(js|mjs|json|...)$` deny rule in nginx.conf.
export const GET: APIRoute = async () => {
  const gst = gstRegistered ? '' : ', no GST';

  const description =
    `TelaLoom builds websites for local and small businesses that get found on Google and in AI answers. ` +
    `Published prices, set up on hosting in your name, first draft in 1–2 weeks.<br>` +
    `🔹 Websites — landing page ${aud(pricing.landingPage)}, Starter site (up to 5 pages) ${aud(pricing.starterSite)}, ` +
    `custom build ${aud(pricing.customBuild)} with Local SEO & GEO included<br>` +
    `🔹 Fix the site you have — free website check, Local SEO & GEO Setup ${aud(pricing.setupSingleTemplate)}<br>` +
    `🔹 Care plan — updates, monitoring and small changes on your own hosting, ${aud(pricing.carePlan)}/mo<br>` +
    `🔹 Software & AI — portals, bookings, automation and AI builds, quoted in writing first<br>` +
    `Prices in AUD${gst}. Bring your business name and website (or Google listing) and we'll tell you ` +
    `which option fits and what it costs, before you pay for anything.<br>`;

  return new Response(
    JSON.stringify({ description, generatedAt: new Date().toISOString() }, null, 2),
    { headers: { 'Content-Type': 'application/json' } }
  );
};
