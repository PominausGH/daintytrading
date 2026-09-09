---
type: "product"
name: "Subscription Incinerator"
title: "Subscription Incinerator — AI-Drafted Subscription Cancellation | Dainty Trading"
description: "Subscription Incinerator finds the subscriptions you've forgotten and cancels the ones you don't want. Claude drafts merchant-specific cancellation emails calibrated to actual policy. SMS chases the rest."
ogTitle: "Subscription Incinerator — burn the subscriptions you don't use"
ogDescription: "Find, track, and cancel unwanted subscriptions with AI-drafted cancellation emails."
ogImage: "https://daintytrading.com/og/subscription.png"
lede: "A consumer app for the subscriptions you forgot you were paying for. Subscription Incinerator finds them, ranks them, and burns the ones you wave through — with AI-drafted cancellation emails calibrated to each merchant’s actual policy."
metaChips:
  - label: "Category"
    value: "AI · Consumer fintech"
  - label: "Stack"
    value: "Next.js · Prisma · Postgres · Redis"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/subscription.png"
  imageWebp: "/screenshots/subscription.webp"
  alt: "Subscription Incinerator screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Domain"
      value: "subscriptionincinerator.app"
    - label: "Frontend"
      value: "Next.js"
    - label: "Backend"
      value: "Node worker · Prisma"
    - label: "Database"
      value: "Postgres · Redis"
    - label: "Email"
      value: "Brevo"
    - label: "Auth"
      value: "Google OAuth"
    - label: "Billing"
      value: "Stripe"
  primaryCta:
    label: "Visit Subscription Incinerator →"
    href: "https://subscriptionincinerator.app"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Email Cleanup"
  href: "/projects/emailcleanup.html"
nextLink:
  label: "Everyring.ai"
  href: "/projects/missed-calls.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "FinanceApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
          <p>Subscription creep is a tax on attention. Most people pay for at least three things they no longer use, and the cancellation flow is deliberately designed to be tedious — chat widgets that route to a human, “reasons for leaving” surveys, retention offers buried behind two more clicks. We wanted to compress that work to a single tap.</p>

          <h2>What we built</h2>
          <p>Subscription Incinerator connects to a user’s Gmail via Google OAuth, scans for receipt patterns, and assembles a list of every active recurring charge. It estimates monthly burn, flags duplicates, and lets the user mark each one as <em>keep</em>, <em>burn</em>, or <em>review later</em>.</p>
          <p>For each cancellation, Claude drafts a polite, merchant-specific email that uses the right legal handle (right to cancel, cooling-off period, refund window) for the user’s region. Brevo sends the email; the worker checks the user’s inbox for a confirmation reply and updates state. If no reply lands within 72 hours, an SMS reminder goes out and a follow-up email is queued.</p>

          <h2>The AI angle</h2>
          <p>The interesting bit is the merchant pattern matching. Each merchant gets a learned profile — what receipts look like, what successful cancellations look like, which canned objections show up. Claude uses that profile when drafting, and updates it from outcomes. Over time, the system gets demonstrably better at incinerating each merchant.</p>

          <h2>How it’s used</h2>
          <ul>
            <li><strong>People returning from a free trial</strong> who’ve forgotten which trials they started.</li>
            <li><strong>Couples consolidating finances</strong> who want one source of truth for shared subs.</li>
            <li><strong>Anyone going into a budget reset</strong> who wants the easy wins first.</li>
          </ul>

          <h2>What it taught us</h2>
          <p>That polite-but-firm beats clever every time. The earliest drafts tried to be witty. The cancellation success rate jumped when we rewrote the prompt to be plain, formal, and aware of consumer law. The lesson generalises: when an AI output has to do real work in the world, restraint usually wins.</p>
