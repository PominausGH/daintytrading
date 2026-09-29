// Wording for the public site-check report. The checker service returns a coarse, price-agnostic
// `outcome`; the numbers and the voice live here. Prices mirror src/data/pricing.ts (the website's
// single source of truth) - if you change pricing there, change the defaults here too.
const pricing = {
  setupAud: Number(process.env.SITECHECK_SETUP_AUD || 3900),
  setupUsd: Number(process.env.SITECHECK_SETUP_USD || 2700),
  buildAud: Number(process.env.SITECHECK_BUILD_AUD || 6900),
  buildUsd: Number(process.env.SITECHECK_BUILD_USD || 4950),
};
const fmt = (n) => n.toLocaleString('en-AU');

const GROUP_LABELS = {
  findability: 'Being found (Google and AI assistants)',
  security: 'Security and trust',
  speed: 'Speed',
  measurement: 'Measurement',
};

const OUTCOME_LABELS = {
  nothing_major: 'Nothing major',
  small_fixes: 'Small fixes',
  setup_scale: 'Setup-sized job',
  rebuild_signal: 'REBUILD SIGNAL',
  not_enough_data: 'Not enough data',
};

function buildRecommendation(report) {
  const outcome = report.outcome;
  const groups = (report.groupsAffected || []).map((g) => GROUP_LABELS[g] || g);
  switch (outcome) {
    case 'nothing_major':
      return {
        outcome,
        headline: "Nothing major to fix",
        body: "Your site has the basics in place. We'll tell you plainly when you don't need us, and this looks like one of those times. If you'd like a second opinion or help with something specific, just get in touch and ask.",
      };
    case 'small_fixes':
      return {
        outcome,
        headline: 'A handful of small fixes',
        body: "These are the kind of things that take a day or so, not a project. Get in touch and we'll quote the fix. We estimate the days up front and you approve it before we start.",
      };
    case 'setup_scale':
      return {
        outcome,
        headline: 'This is a Setup-sized job',
        body: `You've got issues across several areas${groups.length ? ` (${groups.join(', ')})` : ''}. That's what our Setup package is for: we fix it properly, shipped straight into your site, no lock-in. It's ${fmt(pricing.setupAud)} AUD (${fmt(pricing.setupUsd)} USD) one-off, roughly four days of work. Get in touch or book a call and we'll confirm the scope before anything starts.`,
      };
    case 'rebuild_signal':
      return {
        outcome,
        headline: "We'd recommend a rebuild, not a patch",
        body: `Some of what we found suggests the site is running on something too old to patch safely. Bolting fixes onto that costs more than it's worth, and we won't sell you fixes that don't make it secure. A rebuild is usually the better route: a new site with the SEO and AI-search fixes built in, from ${fmt(pricing.buildAud)} AUD (${fmt(pricing.buildUsd)} USD). We'll take a proper look and tell you honestly before you commit to anything.`,
      };
    default: {
      const why = {
        blocked: "Your site's bot protection turned our automated visit away, so we couldn't see the page. That's not necessarily a problem for real visitors, but it's worth checking that search engines and AI assistants aren't being turned away too. Get in touch and we'll take a proper look by hand.",
        unreachable: "We couldn't load your site. Check the address is right and the site is up, then try again. If it is up, get in touch and we'll look into why we couldn't reach it.",
        opted_out: "Your robots.txt asks our checker not to visit, so we respected that and didn't check the site. If you'd like a check anyway, get in touch and we'll do it by hand.",
      }[report.status] || "We couldn't check everything. Get in touch and we'll take a proper look by hand.";
      return { outcome: 'not_enough_data', headline: "We couldn't check everything", body: why };
    }
  }
}

module.exports = { buildRecommendation, GROUP_LABELS, OUTCOME_LABELS, pricing };
