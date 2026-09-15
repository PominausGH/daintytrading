---
type: "product"
status: "live"
name: "Billing API"
title: "Billing API — Shared SaaS Billing Infrastructure | Dainty Trading"
description: "Billing API is the shared payments and subscription service across Dainty Trading's portfolio. Stripe, Brevo, Postgres, Fastify — every product launches with billing wired in on day one."
ogTitle: "Billing API"
ogDescription: "Shared billing service across the Dainty Trading portfolio."
ogImage: "https://daintytrading.com/og/billing-api.png"
lede: "A single billing service backing the whole portfolio. Stripe, subscriptions, metering, refunds, dunning, lifecycle email through Brevo — every new product gets payments wired in on the first day, not the third sprint."
metaChips:
  - label: "Category"
    value: "Infrastructure · SaaS"
  - label: "Stack"
    value: "Node · Fastify · Postgres"
  - label: "Integrations"
    value: "Stripe · Brevo"
  - label: "Status"
    value: "Live"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Access"
      value: "Internal API only"
    - label: "Backend"
      value: "Node · Fastify"
    - label: "Database"
      value: "Postgres"
    - label: "Payments"
      value: "Stripe"
    - label: "Email"
      value: "Brevo"
    - label: "Tests"
      value: "Jest"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Yoga Platform"
  href: "/projects/yoga-platform.html"
nextLink:
  label: "Recipe API"
  href: "/projects/recipe-api.html"
schemaType: "WebAPI"
schemaExtra:
  provider:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Every new product needed billing, and every new product was implementing billing from scratch. Webhook handling, trial logic, plan upgrades, proration, dunning emails — the same code, slightly different bugs, in twenty places. The cost wasn’t the first build; it was the maintenance tax across the portfolio.</p>

<h2>What we built</h2>
<p>Billing API is a Fastify service backed by Postgres that owns customers, plans, subscriptions, invoices, and webhook reconciliation. Every product calls a small set of endpoints — create checkout, get entitlements, cancel subscription — and never touches Stripe directly. The service handles retries, idempotency, plan changes, and downstream lifecycle email through Brevo. Jest tests cover the state machine.</p>

<h2>The automation angle</h2>
<p>The flagship automation is the dunning flow: failed payment triggers a sequence of escalating reminders with grace periods, and reaches a hard cancel only after the configured policy is exhausted. Win-back happens automatically when a cancelled customer renews. The sequence is product-specific without each product having to understand it — the policy lives once, in the API.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Every paid product</strong> in the Dainty Trading portfolio.</li>
<li><strong>Internal admin tools</strong> for support, refunds, and entitlement overrides.</li>
<li><strong>Reporting</strong> rolling up MRR, churn, LTV across the whole portfolio in one place.</li>
</ul>

<h2>What it taught us</h2>
<p>That billing is a state machine, and pretending otherwise costs you sleep. Modeling the lifecycle explicitly — with named states, named transitions, and a strict rule that webhook events can only mutate state through known transitions — turned a class of intermittent bugs into impossibilities. We carry that pattern into every client engagement that touches money.</p>

<h2>Why a shared service instead of a shared library</h2>
<p>The obvious alternative was an npm package every product imports. We didn’t do that, because a shared library still leaves each product owning its own Stripe webhook endpoint, its own retry logic, and its own copy of whatever bug got fixed last. A shared service means the webhook endpoint exists exactly once. When Stripe changes a payload shape or we find an edge case in proration, the fix ships once and every product is patched the moment it deploys — nobody has to bump a dependency version across twenty repos to get it.</p>
<p>The tradeoff is a single point of failure across the portfolio, which is why idempotency isn’t optional: every webhook handler is written to safely reprocess an event it’s already seen, because Stripe retries on anything short of a clean 200, and a service this central will eventually see a duplicate delivery. Getting that right once, centrally, is considerably cheaper than getting it right twenty times.</p>
