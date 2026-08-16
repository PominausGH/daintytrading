# Cross-Property Pricing & Services Sync Audit — Dainty Trading

Use this prompt to re-check that daintytrading.com, bizpage.biz, and
siteready.uk agree with each other on price, currency, and service scope.
These are three separate front-ends for two products run by the same
person — they will drift out of sync unless someone deliberately checks.

Run this after any pricing change on any of the three sites, and otherwise
on a recurring schedule (e.g. monthly) since prices, tiers, and copy get
edited independently on each property.

---

## Prompt

You are a meticulous pricing/consistency auditor. Your job is to find every
place these three properties **contradict each other or contradict their
own live billing code** — not to judge whether prices are "good," just
whether they're internally true.

### Context you must not contradict without re-verifying against live code

Three separate offerings exist, each with its own pricing model. Do not
assume they should match each other — verify each stays internally
consistent with itself, and that no page misrepresents which model applies:

1. **BizPage Builder (bizpage.biz) and SiteReady (siteready.uk)** —
   `/opt/docker/bizpage-builder`. Same Flask app/container, same Stripe
   integration, served under two hostnames via `routes/site_config.py`
   (branding text differs per host; pricing does not). Charged in **USD
   only**, everywhere, via `STRIPE_CURRENCY` (`routes/checkout.py`,
   `docker-compose.yml`) — there is no per-host currency override. AU/UK
   visitors see a **display-only** approximate conversion next to the USD
   price (`get_currency_estimate()` in `site_config.py`, keyed off
   Cloudflare's `CF-IPCountry` header, manually-maintained FX rates, not
   live) — that estimate is never what they're actually charged.
2. **Website Builds / SEO & GEO Optimization / Local SEO & GEO**
   (`/opt/docker/dainty/services/website-builds.html`,
   `seo-geo-optimization.html`, `local-seo.html`, and the summary blurbs in
   `services.html` / `index.html`) — fixed-price packages, quoted flat in
   **AUD** regardless of visitor location. These are Dainty Trading's own
   direct offer, invoiced by Andrew, not run through bizpage's Stripe.
3. **AI product builds / automation retrofits / AI infrastructure**
   (`ai-product-builds.html`, `ai-automation-retrofit.html`,
   `ai-infrastructure.html`, and the regional pages `uk.html`, `usa.html`,
   `australia.html`) — bespoke, quote-based, no published fixed price.
   Invoiced in the **client's own regional currency**: GBP for UK clients,
   USD for US clients, AUD or USD for Australian clients. This is the one
   place currency is *meant* to vary by visitor region — don't flag that
   variance as an error, only flag it if the three regional pages disagree
   with each other about the currency-per-region rule itself.

Site's "Instant page" tier on daintytrading.com is a thin wrapper that
sends the visitor to bizpage.biz/siteready.uk to actually buy — so its
copy must match model #1 (USD, bizpage's live tier structure), not model
#2 (AUD), even though it sits on the same page as the Custom Build tier
that *is* model #2.

### Crawl and review

**daintytrading.com**: `services.html`, `services/website-builds.html`,
`services/seo-geo-optimization.html`, `services/local-seo.html`,
`index.html`, `uk.html`, `usa.html`, `australia.html`, `contact.html` (the
engagement-type dropdown and what happens on submit — see
`api/routes/contact.js`).

**bizpage.biz and siteready.uk** (fetch both live hostnames — same backend,
confirm they actually render identically apart from branding):
homepage/pricing section, any dedicated `/pricing` route if one exists,
the demo site linked from daintytrading (`bizpage.biz/sites/demo/plumber`).

**Underlying code** (source of truth — copy must match this, not the other
way around): `bizpage-builder/routes/checkout.py` (hardcoded Stripe amounts
per plan), `bizpage-builder/routes/site_config.py` (currency estimates,
per-host branding), `bizpage-builder/templates/pricing_section.html`.

### What to check, in order

1. **Price parity within each model.** For every number in models #1 and
   #2 above, does every page that quotes it (price card, JSON-LD `Offer`,
   meta description, FAQ answer text, sidebar `label-row`, any other blurb
   elsewhere on the site) show the *same* figure? List every file:line
   where a stale number survives after a price change — this has happened
   before (a Growth price or Setup price changed in the price card but not
   in the JSON-LD or an FAQ answer three paragraphs down).
2. **Currency labeling.** Every dollar figure must be unambiguous about
   which currency it's in wherever the page mixes models (e.g.
   `website-builds.html` has both a USD tier and an AUD tier on the same
   page — every price there needs an explicit USD/AUD marker, not just
   "$"). Pages that are 100%-one-currency throughout (e.g. `local-seo.html`
   is entirely AUD) don't need every single figure re-labeled, but check
   the page doesn't accidentally introduce a foreign-currency number
   without a label.
3. **Billing code vs displayed copy.** Do the hardcoded Stripe amounts in
   `checkout.py` (`one_time`, `starter`, `pro` — currently 14900, 3900/
   29900, 7900/59900 cents) match what `pricing_section.html` displays for
   the same tiers? A copy change that isn't mirrored in `checkout.py` (or
   vice versa) means someone gets charged a different amount than what
   they read.
4. **Cross-site referral accuracy.** Every place one property links to or
   describes another (daintytrading's Instant Page card linking to
   bizpage.biz; bizpage's "Full-service upsell" box linking to
   daintytrading) — does the linking page's description of the destination
   still match what the destination actually offers/charges? This is the
   category of bug most likely to silently rot: two people editing two
   different codebases independently.
5. **Service/tier existence parity.** Does daintytrading's website-builds
   page mention every tier that actually exists on bizpage.biz (One-Time,
   Starter, Pro), or has a tier been added/removed on one side without the
   other being updated? Same check in reverse for bizpage's "Full-service"
   teaser vs. daintytrading's actual Custom Build scope.
6. **Domain/hosting/ownership claims.** Re-verify wording about who
   registers/owns/hosts the domain (Instant Page: customer brings their
   own or self-hosts a ZIP export, no registration included, per
   `pricing_section.html`'s own disclaimer; Custom Build: Dainty either
   connects an existing domain or registers one in the client's name,
   first year included) hasn't drifted from what's actually offered.
7. **Regional-currency page self-consistency.** Do `uk.html`, `usa.html`,
   and `australia.html` still agree with each other on the underlying
   rule (client's own currency, no fixed price) even if the specific
   wording differs per page? Flag if one of them implies a fixed price or
   a currency that contradicts the other two.

### Output format

For each finding:
- **File(s) and line(s)** — exact location(s) of the contradiction.
- **What each side says** — quote both conflicting statements verbatim.
- **Which one is source-of-truth** — billing code (`checkout.py`,
  `docker-compose.yml` env vars) outranks marketing copy; when two copy
  pages conflict with each other and neither is code, flag it as
  ambiguous rather than guessing which is "right."
- **Severity** — Critical (visitor could be charged something different
  from what they read, or a currency is silently wrong), High (services
  described inconsistently enough to look unprofessional or dishonest if
  a prospect compares both sites), Medium (stale number, no currency
  confusion), Low (cosmetic wording drift).

Do not fix anything in this pass — report only. A second, separate pass
should apply fixes once the list is reviewed by Andrew.
