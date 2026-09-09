---
type: "case-study"
name: "Shuttersmith"
title: "Shuttersmith — SEO & GEO Case Study | Dainty Trading"
description: "Shuttersmith is the first client on Dainty Trading's productised SEO + GEO service — technical SEO, structured data, and generative-engine optimisation for a local business, from audit to ongoing growth."
ogTitle: "Shuttersmith — SEO & GEO Case Study"
ogDescription: "The first client on our productised SEO + GEO service — audit, setup, and ongoing growth for a local business."
ogImage: "https://daintytrading.com/og-card.jpg"
lede: "Shuttersmith is the first client on our productised SEO + GEO service — built to get a local business found by both classic search and the AI assistants now answering “who does this near me” before a search result ever loads."
metaChips:
  - label: "Client"
    value: "Shuttersmith"
  - label: "Service"
    value: "SEO + GEO"
  - label: "Category"
    value: "Local business · Services"
  - label: "Status"
    value: "Active engagement"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Client"
      value: "Shuttersmith"
    - label: "Service"
      value: "SEO + GEO"
    - label: "Engagement started"
      value: "Jul 2026"
    - label: "Tiers used"
      value: "Audit · Setup · Growth"
    - label: "Audit found"
      value: "Zero analytics · no schema · AI crawlers blocked at hosting level"
    - label: "Status"
      value: "Active engagement"
    - label: "Visits since July"
      value: "405 · majority via Google"
  ghostCta:
    label: "See the SEO/GEO service"
    href: "/services/seo-geo-optimization.html"
ctaBannerHeading: "Want your business found by AI search, not just Google?"
ctaBannerBody: "We scope SEO/GEO engagements in 48 hours. Tell us your site and we’ll tell you what’s missing."
prevLink:
  label: "All projects"
  href: "/work.html"
nextLink:
  label: "Shuttersmith Rebuild"
  href: "/projects/shuttersmith-rebuild.html"
schemaType: "CreativeWork"
schemaExtra:
  about: "Technical SEO and generative-engine optimisation for a local business, delivered as Dainty Trading's productised SEO/GEO service."
  creator:
    "@type": "Organization"
    name: "Dainty Trading"
client: "Shuttersmith"
---

<!-- TODO(andrew): still open — the one number this page doesn't have is
an inquiry/job count attributable to the site, and over what period.
Craig's review says "lots more jobs"; a number would turn that from
a quote into evidence. Everything else on the original list (traffic
baseline, engagement dates, specific audit findings) is now filled in
with what's actually verifiable. -->
<h2>The problem</h2>
<p>Shuttersmith sells and installs plantation shutters on the Gold Coast — the kind of business where nearly every job begins with someone searching for a supplier near them. It had been running on word of mouth for years, with no analytics installed at all: not a broken tracker, not undercounted traffic, no measurement of any kind. Whatever the site was doing before this engagement, nobody could say — including us. That is the real starting baseline: not "low traffic," but no visibility into traffic at all.</p>
<p>Search itself has also moved in the time the site went unmaintained. A growing share of “who does X near me” questions are answered before a results page ever loads — by an AI Overview, by ChatGPT, by Perplexity. Those answers get assembled from whatever the assistant can read cleanly and trust. A site with no schema, no <code>llms.txt</code>, and no consistent statement of its own services and service area doesn’t get recommended; it gets skipped in favour of a competitor whose site happens to be legible. Ranking on Google is still necessary. It is no longer sufficient.</p>

<h2>What the audit actually found</h2>
<p>The engagement started with a full technical audit in mid-July 2026 — not a checklist run, but a crawl, an indexation check against Search Console, every piece of structured data validated, and a direct test of how AI crawlers were actually treated, not just what <code>robots.txt</code> claimed. That last test is what turned up the most useful finding, because it wasn’t visible anywhere in the site’s own code.</p>
<p>The site itself had no structured data of any kind, no analytics, and a Google Business Profile set up in a way that risked suspension rather than helping the business rank locally. Ordinary enough faults for a site that had never had a technical pass. The less ordinary one: a server-level rule at the hosting layer — unrelated to anything in the site’s own code — was silently blocking several AI crawlers outright, including ClaudeBot. <code>robots.txt</code> said one thing; the actual server said another, and a bot that’s refused at the network level never even gets far enough to read what <code>robots.txt</code> allows. No amount of on-site GEO work would have fixed that, because the fault wasn’t on the site. We only found it by testing directly, request by request, instead of trusting what the config claimed.</p>
<p>None of this is a story about how badly the previous site was built. It's the normal state of a local trade site that has never had anyone check whether search engines and AI crawlers could actually read it — because usually nobody does check, on either side.</p>

<h2>What we did</h2>
<p>Shuttersmith is the first client on our productised SEO + GEO service, and the proving ground for it — Audit, Setup, then Growth, in that order. Setup work followed straight from what the audit found, not from a generic template.</p>
<p>Analytics went in first, deliberately before anything else, so every change after it could be measured against a real before-and-after rather than asserted. <strong>LocalBusiness schema</strong> followed, written the way a mobile, service-area trade actually operates rather than the way a schema generator defaults to — the business, its service area and its contact details made machine-readable instead of left for a crawler to infer from page copy. <strong>Service-area pages</strong> stated where the business worked instead of leaving it implied. Metadata and Open Graph went in across every page, along with a clean <code>sitemap.xml</code> and <code>robots.txt</code> — and, separately from the site itself, the hosting-level block on AI crawlers got raised and resolved, since no <code>robots.txt</code> change on our side could touch it.</p>
<p>Alongside the technical work sit two things that aren’t code at all: converting the Google Business Profile to a proper service-area listing, and starting a review-generation process. For a local trade, the profile and the reviews attached to it routinely do more work than the website does — skipping straight to on-site polish while leaving those two undone is the most common way this kind of engagement wastes a client’s money, and we didn’t want to make that mistake on our own first client.</p>

<h2>What the numbers show</h2>
<p>Since we started tracking in July, the site has had 405 real visits (as of 6 Sep 2026) — and of the ones with an identifiable source, the large majority came from Google search. Because there was no analytics before this engagement, that number isn’t a lift over a measured baseline; it’s the first traffic this business has ever had visibility into. These are sessions in analytics, not impressions or modelled reach.</p>
<script>
// Weekly cron (api/scripts/update-project-view-stats.py) writes real Umami
// numbers to api/data/project-stats.json; this is a static build so we fetch
// at runtime instead of baking the number in and needing a rebuild every week.
// A raw <span id> embedded inline in this markdown body got mangled by
// Astro's markdown pipeline (block HTML like <p>/<script> passes through
// raw, but inline HTML nested mid-sentence does not) — so instead of an
// id to target, this matches the same dated-visit-count text pattern the
// old Python script used to sed directly into HTML. Silently no-ops if the
// pattern isn't found (e.g. wording here changes later) or the fetch fails.
fetch('/api/project-stats')
.then((r) => (r.ok ? r.json() : null))
.then((data) => {
const s = data && data.shuttersmith;
if (!s) return;
const article = document.querySelector('article.prose');
if (!article) return;
const pattern = /[\d,]+ real visits \(as of [^)]+\)/;
for (const p of article.querySelectorAll('p')) {
if (pattern.test(p.textContent)) {
p.innerHTML = p.innerHTML.replace(
pattern,
`${s.visits.toLocaleString()} real visits (as of ${s.asOf})`
);
break;
}
}
})
.catch(() => {});
</script>
<p>They have converted into customer inquiries rather than sitting as page views. The clearest evidence of that is second-order, and not something we could have engineered: the work brought in enough new business that the client backed a second company entirely — <a href="/projects/new-shutter-business.html">a trade-price, self-install spinoff</a> of the same shutters business — and asked us to build that site too.</p>

<h2>What the client says</h2>
<figure class="testimonial-card">
<blockquote class="testimonial-quote">“We engaged Andrew to have a look at our website,he explained what he needed to do and fixed everything and we our now getting lots more jobs through from.the internet traffic He also built a new website for a new branch of the business The work is fantastic and he absolutely nalied it Its about time we spent some money and got the return you hope for After several companies I have found the one I will be sticking with”</blockquote>
<figcaption class="testimonial-caption">
<span class="testimonial-stars">★★★★★</span>&nbsp;
<strong class="testimonial-name">Craig Smith</strong> · Local Guide · <a href="https://www.google.com/maps/place/?q=place_id:ChIJ2VLpW3U4aoQRz6YI6UQ2hr4" target="_blank" rel="noopener" class="link-dim">read it on Google</a>
</figcaption>
</figure>

<h2>What we are not claiming yet</h2>
<p>Fixing the hosting-level AI-crawler block removed a hard barrier, but it isn’t the same as an AI-search win. The GEO half of the engagement is still in progress — the site’s <code>llms.txt</code> is the next thing to ship — so every number above is Search only. We are not claiming an AI-search win on this site, because we haven’t measured one. Once <code>llms.txt</code> is live and AI referrals show up in the analytics the way they already do across our own products, we’ll report whatever they actually are.</p>
<p>We’ll update this page with full before-and-after numbers as the engagement matures. The honest position today: measurable organic traffic where there had been effectively none, a client who reinvested on the strength of it, and a GEO layer still to land.</p>
