---
type: "product"
name: "Banking Alerts"
title: "Banking Alerts — Dainty Trading"
description: "Push-notification alerts when bank balances drop below thresholds. No app to install, no SaaS subscription — just an n8n flow on top of Open Banking that pings your phone when something needs attention."
ogTitle: "Banking Alerts"
ogDescription: "Push-notification alerts when bank balances drop below thresholds. No app to install, no SaaS subscription — just an n8n flow on top of Open Banking that pings your phone when something needs attention."
ogImage: "https://daintytrading.com/og/banking-alerts.png"
lede: "Push-notification alerts when bank balances drop below thresholds. No app to install, no SaaS subscription — just an n8n flow on top of Open Banking that pings your phone when something needs attention."
metaChips:
  - label: "Category"
    value: "Fintech · Automation"
  - label: "Stack"
    value: "Basiq API · n8n · ntfy"
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
      value: "banking.daintytrading.com"
    - label: "Banking"
      value: "Basiq Open Banking API"
    - label: "Orchestration"
      value: "n8n"
    - label: "Notifications"
      value: "ntfy"
    - label: "Region"
      value: "Australia"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Finance Tracker"
  href: "/projects/finance-tracker.html"
nextLink:
  label: "Telegram Crypto Sentiment"
  href: "/projects/telegram-crypto-sentiment.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Banks notify you about marketing offers and not about the things you actually want to know. “Your offset account just dropped below the buffer” is the alert most account holders would actually open. Setting it up requires either a fintech app you don’t want or a custom integration nobody wants to build.</p>

<h2>What we’re building</h2>
<p>Banking Alerts is the studio’s own minimal version. The Basiq Open Banking API handles consent and account access (Australia-only at the moment). An n8n flow polls balances on a schedule, applies user-defined thresholds, and fires notifications through ntfy — an open-source push service that doesn’t require an account on the recipient’s end.</p>

<h2>The automation angle</h2>
<p>All in n8n, deliberately. The whole flow — auth refresh, balance fetch, threshold check, notification fan-out — lives in a graph anyone on the team can read and edit. It also means we can extend it (transaction categorisation, alerts on suspicious patterns) without touching code.</p>
<p>Open Banking consent under the Consumer Data Right is Australia-specific by design, which is why this stays a local-market tool rather than a general one: the consent model, the data the API actually exposes, and the compliance obligations around holding it are all set by CDR rules that don’t transfer to other markets. Building for one regulatory regime properly beats building for several badly.</p>

<h2>Why ntfy over a native app</h2>
<p>ntfy’s no-account model is the point, not a shortcut. A push alert about your own bank balance is exactly the kind of data you don’t want sitting in a third party’s user database against your name and phone number. Subscribing to a topic requires nothing more than knowing the topic name, so the notification service itself never learns whose balance it’s pinging.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Households</strong> running offset and savings buffers that need to stay above minimums.</li><li><strong>Sole traders</strong> watching their business account before paying suppliers.</li><li><strong>Anyone with auto-pays</strong> who wants warning before a direct debit tips the balance.</li></ul>

<h2>Where we are</h2>
<p>Auth, polling, and threshold alerts are working. Next milestone is multi-recipient routing (different thresholds, different phones) and a small admin UI for non-technical users to manage their own thresholds without touching n8n.</p>
