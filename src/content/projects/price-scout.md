---
type: "product"
name: "Price Scout"
title: "Price Scout — Dainty Trading"
description: "A cost-of-living dashboard that tracks grocery, fuel, and energy prices across Australia and the UK. Households see how their spending compares week to week — without manually checking five supermarket apps."
ogTitle: "Price Scout"
ogDescription: "A cost-of-living dashboard that tracks grocery, fuel, and energy prices across Australia and the UK. Households see how their spending compares week to week — without manually checking five supermarket apps."
ogImage: "https://daintytrading.com/og/price-scout.png"
lede: "A cost-of-living dashboard that tracks grocery, fuel, and energy prices across Australia and the UK. Households see how their spending compares week to week — without manually checking five supermarket apps."
metaChips:
  - label: "Category"
    value: "AI · Cost-of-living"
  - label: "Stack"
    value: "Next.js 14 · Postgres · Prisma · BullMQ"
  - label: "LLM"
    value: "—"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In final testing"
    - label: "Site"
      value: "pricescout.daintytrading.com"
    - label: "Frontend"
      value: "Next.js 14"
    - label: "Database"
      value: "Postgres · Prisma"
    - label: "Workers"
      value: "BullMQ on Redis"
    - label: "Source"
      value: "SerpAPI"
    - label: "Coverage"
      value: "AU · UK"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "ConvoForge"
  href: "/projects/convoforge.html"
nextLink:
  label: "Auto-Claude"
  href: "/projects/auto-claude.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Cost-of-living conversations are mostly anecdote. The data exists — supermarkets, fuel stations, and energy providers all publish prices — but it’s scattered, formatted differently, and goes stale by the time anyone aggregates it. Households can’t tell if their grocery bill is rising because of inflation or because their habits changed.</p>

<h2>What we’re building</h2>
<p>Price Scout scrapes weekly price snapshots across major Australian and UK retailers via SerpAPI, normalises them into a per-item-per-region database, and surfaces trends week-over-week. Households connect their preferred basket — what they actually buy — and see whether their spend is tracking with the broader market or drifting.</p>

<h2>The data angle</h2>
<p>The interesting work isn’t the scraping — it’s the normalisation. “500g pasta” means six different SKUs across six retailers; matching them takes a structured product taxonomy that’s curated, not learned. We treat the taxonomy as the asset.</p>
<p>Running two countries at once forces decisions a single-market tool never has to make. AU and UK retailers publish on different schedules, price the same staple in different currencies and pack sizes, and don’t share a category taxonomy — “fuel” in one region maps cleanly to litres of unleaded, in the other to a handful of grades with their own regional quirks. BullMQ workers on Redis queue each retailer’s scrape independently, so one source going stale or changing its page structure doesn’t stall the rest of the pipeline — it just leaves that source’s series with a gap, which is far easier to spot and backfill than a full pipeline outage.</p>
<p>The basket itself is deliberately the household’s own, not a fixed representative basket like the ones government inflation figures use. A representative basket answers “what happened to prices in general” — useful for policy, not for a household deciding whether its own bill going up is normal or something to act on. Matching against what someone actually buys is a different, harder question, and the one the dashboard is built to answer.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Households</strong> doing a budget reset who want a baseline.</li><li><strong>Journalists and policy researchers</strong> who need cost-of-living data without paying for ABS or ONS API access.</li><li><strong>Comparison sites</strong> who want a clean per-item history feed.</li></ul>

<h2>Where we are</h2>
<p>Scrapers and the taxonomy are working. The household dashboard is in private testing with a small group of users in both regions. Next milestone is the alerts layer — tell users when an item in their basket spikes or drops more than a threshold.</p>
