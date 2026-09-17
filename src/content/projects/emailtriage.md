---
type: "product"
status: "live"
name: "Email Triage"
title: "Email Triage — AI Inbox Categorization with Claude | TelaLoom"
description: "Email Triage uses Claude to categorize incoming Gmail and Outlook mail, score priority 1–10, and draft replies. Multi-account, offline PWA, push notifications, Stripe billing. Built by TelaLoom."
ogTitle: "Email Triage — AI inbox categorization"
ogDescription: "Claude-powered email triage that categorizes, scores, and drafts replies across multiple accounts."
ogImage: "https://telaloom.com/og/emailtriage.png"
lede: "A Claude-powered email triage system that categorizes, scores, and drafts replies across every Gmail and Outlook account you connect. Built for people whose inbox is the bottleneck."
metaChips:
  - label: "Category"
    value: "AI · Productivity"
  - label: "Stack"
    value: "TypeScript · React 19 · Postgres · Redis"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "Live in staging"
screenshot:
  image: "/screenshots/emailtriage.png"
  imageWebp: "/screenshots/emailtriage.webp"
  alt: "Email Triage screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live (staging)"
    - label: "Domain"
      value: "email-triage.app"
    - label: "Backend"
      value: "Node · Express · TS"
    - label: "Frontend"
      value: "React 19 PWA"
    - label: "Database"
      value: "Postgres · Prisma"
    - label: "Queue"
      value: "Bull on Redis"
    - label: "LLM"
      value: "Anthropic Claude"
    - label: "Billing"
      value: "Stripe"
  primaryCta:
    label: "Visit Email Triage →"
    href: "https://email-triage.app"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "BrightPath"
  href: "/projects/brightpath.html"
nextLink:
  label: "Email Cleanup"
  href: "/projects/emailcleanup.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web, iOS PWA, Android PWA"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
    url: "https://telaloom.com"
  offers:
    "@type": "Offer"
    price: "9.00"
    priceCurrency: "USD"
---

<h2>The problem</h2>
<p>Most knowledge workers don’t have an email problem — they have a triage problem. The signal is in the inbox, but it’s buried under newsletters, notifications, polite no-thanks, and threads that have already concluded without anyone deciding to close them. The cost of fixing this with rules is high; the cost of delegating is higher. We wanted something that read every message, decided what mattered, and saved a draft reply when one was obvious.</p>

<h2>What we built</h2>
<p>Email Triage connects to one or more Gmail or Outlook accounts via OAuth and continuously syncs new messages into Postgres. A worker queue (Bull on Redis) feeds each thread to Claude with a prompt tuned for short, deterministic JSON output: <strong>category</strong> (one of seven), <strong>priority</strong> (1–10), <strong>summary</strong>, and an optional <strong>draft reply</strong>.</p>
<p>The frontend is a React 19 PWA with TanStack Query. It works offline once seeded, sends push notifications when something high-priority lands, and groups inbox views by AI-assigned category. Stripe handles billing on a per-account-per-month plan. Passport.js fronts the OAuth flows.</p>

<h2>The AI angle</h2>
<p>The interesting work isn’t the prompt — it’s everything around it. We log every Claude call against the email, the model version, the temperature, and the user’s eventual override (did they re-categorise, did they actually send the draft). That gives us an evaluation set that grows by itself, which we re-run nightly against new prompt candidates before we ship them. The gap between a good AI feature and a great one is whether you can answer the question “is this prompt better than yesterday’s?” with data instead of vibes.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Solo founders</strong> connect their personal and business Gmail and let the priority score decide what gets opened first.</li>
<li><strong>Customer support teams</strong> use the categoriser as a pre-filter before email even reaches the helpdesk.</li>
<li><strong>Anyone with three+ inboxes</strong> uses the unified view and stops switching tabs.</li>
</ul>

<h2>What it taught us</h2>
<p>That LLMs are good enough at email categorisation that the bottleneck moved to the boring stuff — OAuth refresh tokens, Gmail’s push subscription quirks, Outlook’s pagination, push notification permissions on iOS PWAs. Half the codebase is plumbing that earns no podium time but decides whether the product feels reliable. That layer now lives in our shared infrastructure for every product that follows.</p>
