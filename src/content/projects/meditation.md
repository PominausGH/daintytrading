---
type: "product"
status: "testing"
unlisted: true
name: "Meditation"
title: "Meditation — Subscription Meditation Library | TelaLoom"
description: "A subscription meditation library with a 7-day free trial, Stripe billing, and a content gate that doesn't feel like a content gate. Built on Next.js and FastAPI."
ogTitle: "Meditation — guided scripts as a subscription"
ogDescription: "Library of guided meditation scripts with a 7-day free trial and Stripe billing."
ogImage: "https://telaloom.com/og/meditation.png"
lede: "A subscription library of guided meditation scripts. Seven-day free trial, Stripe billing, content gating that respects the reader, and a Next.js front-end that loads in under a second on a slow phone."
metaChips:
  - label: "Category"
    value: "Wellness · SaaS"
  - label: "Stack"
    value: "Next.js · FastAPI · Postgres"
  - label: "Billing"
    value: "Stripe"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In final testing"
    - label: "Domain"
      value: "meditation.telaloom.com"
    - label: "Frontend"
      value: "Next.js 14"
    - label: "Backend"
      value: "Python · FastAPI"
    - label: "Database"
      value: "Postgres · Redis"
    - label: "Auth"
      value: "JWT"
    - label: "Billing"
      value: "Stripe"
  primaryCta:
    label: "Visit Meditation →"
    href: "https://meditation.telaloom.com"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Ghost Writer"
  href: "/projects/ghost-writer.html"
nextLink:
  label: "Nudgle"
  href: "/projects/skeddy.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "HealthApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Meditation apps assume audio is the only medium. For a real subset of users — teachers, facilitators, therapists, anyone who runs sessions for groups — what they actually need is the script. We built a service for the people who deliver meditation, not just consume it.</p>

<h2>What we built</h2>
<p>A library of guided meditation scripts organised by length, theme, audience (adults, kids, couples, groups), and tone. Subscribers get unlimited reads and downloads; non-subscribers can sample. The frontend is Next.js with static generation for browsing and server rendering for the gated reading experience. The backend is FastAPI on Postgres with Redis for caching and a clean Stripe subscription lifecycle (trial, active, paused, cancelled, refunded).</p>

<h2>The automation angle</h2>
<p>The interesting automation is the funnel: cohort-aware lifecycle emails through Brevo, a churn-aware win-back flow, and a usage report that tells subscribers which scripts they read most so renewal feels obvious. None of it requires AI — it requires being honest about what subscribers actually do with the product.</p>
<p>Subscription state is driven entirely by Stripe’s webhooks, not by anything the client asserts. The app never trusts a “user says they paid” signal; it waits for <code>customer.subscription.*</code> events and updates access from there, which is the only way trial-to-paid, pause, and cancellation stay consistent when a card fails silently in the background or a subscriber cancels from Stripe’s own billing portal rather than inside the app. Redis sits in front of the content library so the gated reading experience doesn’t re-check entitlement against Postgres on every page view — entitlement changes rarely, reads happen constantly, and the cache only needs to be right, not instant.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Yoga and meditation teachers</strong> sourcing scripts for studio classes.</li>
<li><strong>Therapists</strong> using grounding and visualisation scripts in client sessions.</li>
<li><strong>Corporate facilitators</strong> running short pre-meeting decompression scripts.</li>
</ul>

<h2>What it taught us</h2>
<p>That a Stripe trial is the easiest place to lose a customer. Removing one input from the trial signup — we made the email optional during the first three days — lifted trial-to-paid conversion by a meaningful amount. The lesson generalises across every paid product we run.</p>
