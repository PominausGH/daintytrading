---
type: "product"
name: "StoryPulse"
title: "StoryPulse — Instagram Growth Automation SaaS | Dainty Trading"
description: "StoryPulse automates Instagram story views and reactions on behalf of connected accounts, drives profile visits and follower growth, and publishes AI-generated captions through the Meta Graph API."
ogTitle: "StoryPulse — Instagram growth on autopilot"
ogDescription: "Automated story views, AI captions, anti-detection, multi-account campaigns, Stripe-billed plans."
ogImage: "https://daintytrading.com/og/storypulse.png"
lede: "An Instagram growth-automation SaaS for creators and agencies. Automated story views and reactions drive profile visits; AI writes captions, hooks, and hashtags; multi-account campaigns target by hashtag, location, or competitor — with the anti-detection layer that decides whether any of it actually works."
metaChips:
  - label: "Category"
    value: "AI · Marketing automation"
  - label: "Stack"
    value: "Next.js · Postgres · Prisma · BullMQ"
  - label: "LLM"
    value: "OpenRouter (captions)"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Site"
      value: "storypulse.daintytrading.com"
    - label: "Frontend"
      value: "Next.js"
    - label: "Database"
      value: "Postgres · Prisma"
    - label: "Workers"
      value: "BullMQ on Redis"
    - label: "Proxies"
      value: "iProyal (per-account)"
    - label: "Publishing"
      value: "Meta Graph API"
    - label: "Billing"
      value: "Stripe (tiered)"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "FakeCall"
  href: "/projects/fakecall.html"
nextLink:
  label: "DevTodo"
  href: "/projects/devtodo.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Organic growth on Instagram is a full-time second job, and most paid “growth” tools either get accounts banned or quietly do nothing. Creators and small agencies need a system that <em>actually drives discovery</em> without burning the asset they’re trying to grow. That’s a balance of throughput, behaviour, and infrastructure most off-the-shelf tools fail to hold.</p>

<h2>What we’re building</h2>
<p>StoryPulse connects Instagram accounts via session-cookie auth and runs configurable campaigns. Targeting is by hashtag, location, or competitor account. Background workers (BullMQ on Redis) view stories of targeted users throughout the day, optionally sending emoji reactions to surface in their notifications. Engagement events are logged with attribution — did a story view turn into a profile visit, did the visit turn into a follow.</p>
<p>Content publishing is the other half. Users upload videos, AI generates caption copy / hooks / hashtags, and StoryPulse publishes through the official Meta Graph API. Tiered subscriptions (Starter, Growth, Agency) gate account count, daily action volume, and AI generation quotas; Stripe handles billing.</p>

<h2>The anti-detection layer</h2>
<p>This is where the real engineering lives. Per-account proxy rotation through iProyal. Human-behaviour mimicry — randomised delays, session warm-up preludes, viewing patterns that don’t look like a script. Strict rate limiting and a 14-day warm-up cap for new accounts. Health monitoring detects banned, challenged, or expired sessions and pauses the account before more damage is done. The platform’s value is directly proportional to how seriously this layer is taken.</p>

<h2>The AI angle</h2>
<p>AI shows up in two places. The caption generator turns a video and a brand brief into three caption variants (short hook, long-form, CTA-led), with hashtag sets calibrated to reach without spam-flagging. The targeting recommender suggests hashtags and competitors based on the account’s niche — same idea as the matchers we built for CV Matcher, applied to Instagram audiences.</p>

<h2>How it’ll be used</h2>
<ul>
<li><strong>Solo creators</strong> who can’t spend three hours a day on growth manually.</li>
<li><strong>Small social agencies</strong> running 5–50 client accounts who need health monitoring and campaign templating.</li>
<li><strong>Brands launching new accounts</strong> who need a safe warm-up runway before scaling activity.</li>
</ul>

<h2>Where we are</h2>
<p>Campaign management, story-view automation, content publishing through the Graph API, and Stripe billing are working. Caption generation is integrated and being tuned. Public launch is gated on the anti-detection layer hitting our internal tolerance for false-positive bans across a multi-week soak test — this is one of those products where shipping early would destroy more value than waiting six weeks costs.</p>
