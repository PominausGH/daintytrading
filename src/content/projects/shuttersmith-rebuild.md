---
type: "case-study"
name: "Shuttersmith Rebuild"
title: "Shuttersmith — Full Site Rebuild, WordPress to Astro | TelaLoom"
description: "A full rebuild of Shuttersmith's website off WordPress/Elementor onto a static Astro build served from a hardened nginx container — real migrated content, a first-party contact microservice, and performance/accessibility scores verified against real Lighthouse runs, not assumed."
ogTitle: "Shuttersmith — Full Site Rebuild, WordPress to Astro"
ogDescription: "Off WordPress/Elementor entirely — a static Astro rebuild with verified Lighthouse scores and a first-party contact form."
ogImage: "https://telaloom.com/og-card.jpg"
lede: "Following the SEO/GEO engagement, Shuttersmith's site itself got rebuilt — off WordPress and Elementor entirely, onto a static Astro build with real migrated content, a first-party contact service, and performance numbers checked against real Lighthouse runs rather than assumed."
metaChips:
  - label: "Client"
    value: "Shuttersmith"
  - label: "Service"
    value: "Website build"
  - label: "Category"
    value: "Local business · Services"
  - label: "Status"
    value: "Built · awaiting client sign-off"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Client"
      value: "Shuttersmith"
    - label: "Related project"
      value: "SEO/GEO engagement"
    - label: "From"
      value: "WordPress + Elementor + NitroPack"
    - label: "To"
      value: "Static Astro, nginx, hardened Docker"
    - label: "Pages migrated"
      value: "7 top-level · 10 blog posts · 10 suburb pages"
    - label: "Lighthouse"
      value: "Perf 92-98 · Accessibility 100 · Best Practices 100 · SEO 100"
    - label: "Status"
      value: "Built, in preview · pending Craig's sign-off"
  ghostCta:
    label: "See website build services"
    href: "/services/website-builds.html"
ctaBannerHeading: "Running an old WordPress site and feeling it?"
ctaBannerBody: "We scope rebuilds in 48 hours and ship a first working preview in 1-2 weeks."
prevLink:
  label: "Shuttersmith (SEO/GEO)"
  href: "/projects/shuttersmith.html"
nextLink:
  label: "New Shutter Business"
  href: "/projects/new-shutter-business.html"
schemaType: "CreativeWork"
schemaExtra:
  about: "Full website rebuild off WordPress onto a static Astro build, for a local plantation shutters business."
  creator:
    "@type": "Organization"
    name: "TelaLoom"
client: "Shuttersmith"
---

<h2>The problem</h2>
<p>The <a href="/projects/shuttersmith.html">SEO/GEO engagement</a> fixed what could be fixed without touching the platform underneath: analytics, structured data, a hosting-level block on AI crawlers, a Google Business Profile that risked suspension. All of that was real, and it worked. None of it changed what the site was actually built on — WordPress, running Elementor for layout and NitroPack for performance, the standard stack a local trade business ends up on because someone sets it up once and nobody revisits the decision.</p>
<p>That stack has its own failure modes, and they don't show up in an SEO audit. A plugin conflict between Elementor and NitroPack had, at one point, silently broken a JS-gated content reveal on the live site — leaving whole sections permanently blank, with no error, no console warning, nothing an SEO crawl would ever catch. The site could have perfect schema and a perfect crawl policy and still be quietly failing visitors in a way none of that measures. Fixing findings one at a time on a fragile platform has a ceiling. At some point the more honest fix is to stop patching the platform and replace it.</p>

<h2>What we built</h2>
<p>A full rebuild in static Astro, output as plain HTML/CSS/JS with no server-side rendering and no database — served by nginx from a multi-stage Docker image that never even contains Node, npm, or <code>node_modules</code> in the shipped container. There is no admin panel to compromise, no PHP runtime to patch, no plugin ecosystem to silently conflict with itself. The attack surface of a WordPress install and the attack surface of static files served by nginx are not close to comparable.</p>
<p>Content was migrated, not templated with filler: <strong>7 unique top-level pages</strong> carried across with their real copy, <strong>10 blog posts</strong> moved onto a proper content-collection template, and <strong>10 Gold Coast suburb pages</strong> rebuilt from a shared location template — which is also where a real data-quality problem turned up and got fixed once at the template level, instead of being copy-pasted ten more times the way the original pages had been. A <strong>privacy policy</strong> and <strong>terms page</strong> were drafted from scratch (the site didn't have real ones before), and the third-party Blinq contact widget was replaced with a first-party contact microservice — honeypot spam trap, server-side validation, rate limiting, and a local audit trail of every submission, instead of handing form data to someone else's embed.</p>
<p>The container itself is locked down beyond "it runs": capabilities dropped to only what nginx needs, <code>no-new-privileges</code>, memory and process-count limits, and every response carries a full security-header set — including catching a real bug before it shipped, where nginx's per-location <code>add_header</code> behaviour was silently dropping the HSTS header on individual pages even though it was declared correctly at the server level.</p>

<h2>Verified, not assumed</h2>
<p>The rebuild's performance and accessibility claims are checked against real Lighthouse runs against the actual built site, not estimated. The first honest run came back at Performance 82/100 — below the target and a real number, not a guess — and got fixed with measurements guiding each step: converting every product image to WebP (687 KiB of page weight down to 307 KiB), preloading the hero's background image, and deferring the Google Fonts stylesheet without loosening the site's <code>script-src 'self'</code> CSP to do it. The same pass caught a genuine WCAG contrast failure — white button text on the brand green only hit 2.04:1 against a 4.5:1 requirement — and fixed it by changing the text colour, not the brand colour.</p>
<p>Final scores: <strong>Performance 92-98, Accessibility 100, Best Practices 100, SEO 100</strong> — matching or beating the live WordPress site's own scores (96-98/89/100/93) on a plain container with no CDN or caching layer in front of it.</p>
<p>A later design pass — requested feedback was that the first version read as too close to its WordPress predecessor — added dark mode (system-preference aware, with a manual toggle, using a CSP-safe inline script so there's no flash of the wrong theme on load) and scroll-triggered reveals for the service and review cards. That second part was built deliberately defensively: content is visible by default in plain CSS, and the reveal script only ever adds a hide-then-reveal class, only if <code>IntersectionObserver</code> actually runs. If the script fails to load for any reason, nothing disappears — the direct fix for the exact class of failure that had silently broken sections of the WordPress site.</p>

<h2>What's still open</h2>
<p>This isn't live yet. It's built and running in a preview environment, walked end to end (all pages returning 200, console clean, CSP holding), but a short list of items needs Craig before it can go live — his real ABN (currently a placeholder in the footer and privacy policy), his actual quote/deposit/cancellation terms (currently bracketed placeholders on the terms page), a decision on a likely typo in one customer review carried over verbatim from the live site, and a solicitor's pass over the privacy policy and terms before either is published as legally binding. None of that is unusual for a rebuild — a new site can match or beat the old one on every technical measure and still need a short, unglamorous list of business facts only the client can supply before it's real.</p>

<h2>Why this one, and what it led to</h2>
<p>Shuttersmith is the client TelaLoom has now done the most work for, across three separate engagements on the same relationship: the original SEO/GEO audit and fix, this full rebuild, and — because the first two worked well enough that Craig backed a second company on the strength of it — <a href="/projects/new-shutter-business.html">a trade-price, self-install spinoff site</a> we built for that new business too. Three engagements from one relationship isn't the plan for every client. It's what happens when the first piece of work is good enough that the client keeps coming back with more of it.</p>
