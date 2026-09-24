---
type: "product"
status: "live"
name: "Marketing OS"
title: "Marketing OS — Internal Marketing Operations Platform | TelaLoom"
description: "Marketing OS is the internal control tower for TelaLoom's marketing — cross-portfolio SEO/GEO audits, Search Console visibility, and per-product customer tracking, in one Next.js dashboard."
ogTitle: "Marketing OS"
ogDescription: "Audits, search visibility, and customer tracking for the whole portfolio, in one dashboard."
ogImage: "https://telaloom.com/og/marketing-os.png"
lede: "The internal control tower for our portfolio. Four views — Audits, Search Visibility, Customers, Project Overview — give us one place to see whether every product is healthy, indexed, and actually getting used."
metaChips:
  - label: "Category"
    value: "AI · Marketing Ops"
  - label: "Stack"
    value: "Next.js 14 · TypeScript · Prisma · Tailwind"
  - label: "Automation"
    value: "Puppeteer · Search Console API"
  - label: "Status"
    value: "Live"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Access"
      value: "Internal use only"
    - label: "Stack"
      value: "Next.js 14 · TS · React 18"
    - label: "ORM"
      value: "Prisma"
    - label: "Styling"
      value: "Tailwind CSS"
    - label: "Automation"
      value: "Puppeteer"
    - label: "A11y"
      value: "axe-core"
    - label: "Views"
      value: "Audits · Search Visibility · Customers · Overview"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Nudgle"
  href: "/projects/skeddy.html"
nextLink:
  label: "ConvoForge"
  href: "/projects/convoforge.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Running close to 40 products means running close to 40 sets of SEO/GEO checks, indexing status, and usage numbers. Doing that by hand on each domain doesn’t scale, and it doesn’t compound — a fix on one site teaches you nothing about the other 39 unless something is watching all of them at once. We built one internal dashboard that watches the whole portfolio instead of checking products one at a time.</p>

<h2>What we built</h2>
<p>Marketing OS is a Next.js 14 application backed by Prisma and Postgres, built around four views. <strong>Audits</strong> runs Puppeteer plus Google’s PageSpeed Insights API across every live domain — meta tags, structured data, canonical URLs, broken links, axe-core accessibility, performance — and stores the findings per domain. <strong>Search Visibility</strong> pulls indexing coverage and search-analytics totals straight from Search Console via a zero-dependency, JWT-signed client (no <code>googleapis</code> package). <strong>Customers</strong> tracks who’s actually using each of the 11 products that have real accounts, reading from whichever store that product actually uses — Postgres role or SQLite — instead of forcing every product onto one shared schema. <strong>Project Overview</strong> is the single screen that answers “is everything up and healthy right now” across the whole portfolio.</p>

<h2>The AI angle</h2>
<p>The audit findings feed a separate GEO module that generates <code>llms.txt</code>, an AI-crawler-aware <code>robots.txt</code>, and <code>FAQPage</code>/<code>Organization</code> structured data per domain — so a fix that starts as an audit finding can go straight to a generated file without leaving the tool. The weekly cross-portfolio audit itself runs as a scheduled Claude Code skill that writes its findings back into Marketing OS’s own <code>audits/</code> directory, one per domain, which is what actually gets read before any fix gets proposed.</p>

<h2>What it doesn’t do</h2>
<p>Earlier versions of this page described a campaign-planning calendar and an AI content-brief queue living here. That never shipped in this app — content production and scheduling run through a separate pipeline (Ghost Writer drafts, PostReel posts them out, orchestrated in n8n), not Marketing OS. PostReel keeps a separate workspace per product, so posts go out under each site’s own branding and channels rather than one combined feed. This page describes what the tool actually does today: audit, index-track, and report on customer usage across the portfolio, not plan, write, or post the content itself.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Studio operator (me)</strong> checks Project Overview first thing to see what’s down or regressed before touching anything else.</li>
<li><strong>Weekly audit cron</strong> writes fresh findings into every domain’s folder under <code>audits/</code>, which is what a fix session actually reads.</li>
<li><strong>Customers view</strong> is the fast answer to “is anyone actually using this” before sinking more time into a product.</li>
</ul>

<h2>What it taught us</h2>
<p>That an internal tool is only worth what you actually keep open. The audits/search-visibility/customers loop gets checked every week; the campaign-calendar idea never got used once and quietly rotted until the page describing it was the only place it still existed. We carry that lesson into client engagements: build the screen that gets opened, not the one that sounded good in the pitch.</p>
