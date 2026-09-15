---
type: "product"
status: "dev"
name: "Finance Tracker"
title: "Finance Tracker — Dainty Trading"
description: "A clean personal finance tracker for income, expenses, and budgets over time. No bank-feed wizardry, no upsells — just a place to log money in and out and see the trend."
ogTitle: "Finance Tracker"
ogDescription: "A clean personal finance tracker for income, expenses, and budgets over time. No bank-feed wizardry, no upsells — just a place to log money in and out and see the trend."
ogImage: "https://daintytrading.com/og/finance-tracker.png"
lede: "A clean personal finance tracker for income, expenses, and budgets over time. No bank-feed wizardry, no upsells — just a place to log money in and out and see the trend."
metaChips:
  - label: "Category"
    value: "Personal finance"
  - label: "Stack"
    value: "Node.js · Express · React · Postgres"
  - label: "LLM"
    value: "—"
  - label: "Status"
    value: "In development"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Site"
      value: "finance.daintytrading.com"
    - label: "Backend"
      value: "Node.js · Express"
    - label: "Frontend"
      value: "React"
    - label: "Database"
      value: "Postgres"
    - label: "Approach"
      value: "Manual entry first"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Prompt Builder"
  href: "/projects/prompt-builder.html"
nextLink:
  label: "Banking Alerts"
  href: "/projects/banking-alerts.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Most personal finance apps either drown the user in features (investments, retirement modelling, credit scores) or hide the basics behind a paywall. We wanted the simplest possible thing — log it, categorise it, see the chart — built for our own use.</p>

<h2>What we’re building</h2>
<p>A React frontend over a Node + Express API on Postgres. Manual transaction entry is the primary flow (CSV import for batch). Categories are user-defined, budgets are monthly, and the chart on the home screen tells you the only thing that matters: are you in or out for the period.</p>

<h2>The automation angle</h2>
<p>Deliberately none. The lesson from previous personal-finance attempts is that automation increases setup friction and reduces ongoing engagement — the user never trusts what they didn’t see go in. Manual entry is faster than people think once it’s a 30-second daily habit.</p>
<p>Bank-feed integrations also carry a maintenance cost that rarely shows up in the pitch. Every bank connection is a scraper or an OAuth grant that can silently break on the bank’s side — a login flow changes, a token expires, a security update reroutes the feed — and the user finds out weeks later when the chart quietly stops moving. A tool with no feed to maintain has no version of that failure. It costs the user thirty seconds a day instead, which is a trade most people underestimate until they’ve lived through the alternative.</p>

<h2>Why categories stay user-defined</h2>
<p>Pre-built category lists are built for the average household, and almost nobody’s spending looks like the average household’s. Forcing a fixed taxonomy means either bending real spending into categories that don’t fit, or abandoning the categorisation altogether once the mismatch gets annoying enough. Letting the user define their own categories from day one means the budget view means exactly what they intended it to mean, at the cost of a slightly longer setup the first time.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>People in a budget reset</strong> who want a no-frills tracker.</li><li><strong>Couples sharing visibility</strong> on household spending without a SaaS subscription.</li><li><strong>Anyone tired of free apps becoming paid apps</strong> mid-financial-year.</li></ul>

<h2>Where we are</h2>
<p>Core CRUD, categories, budgets, and the dashboard chart are working. Next milestone is recurring entries (rent, salary, regular bills) and a clean export.</p>
