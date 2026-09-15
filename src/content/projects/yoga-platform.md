---
type: "product"
status: "dev"
name: "Yoga Platform"
title: "Yoga Platform — 500+ Poses, Sequence Builder, Mobile + Web | Dainty Trading"
description: "A full-stack yoga platform: 500+ poses with rich filters (chakra, prop, body part, style), a sequence builder, favourites, and progress tracking. Built on Supabase with a Vite web app and an Expo mobile app."
ogTitle: "Yoga Platform"
ogDescription: "500+ yoga poses, sequence builder, mobile + web."
ogImage: "https://daintytrading.com/og/yoga-platform.png"
lede: "A reference for yoga teachers and serious practitioners. Five hundred poses, deep filters that match how teachers actually plan classes, a sequence builder that travels, and a mobile app that works without signal."
metaChips:
  - label: "Category"
    value: "Wellness · Mobile"
  - label: "Stack"
    value: "Vite · Expo · Supabase · TS monorepo"
  - label: "Status"
    value: "In development"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Domain"
      value: "yoga.daintytrading.com"
    - label: "Web"
      value: "Vite + React 18"
    - label: "Mobile"
      value: "Expo SDK 50"
    - label: "Backend"
      value: "Supabase (Postgres + Auth + Storage)"
    - label: "State"
      value: "Zustand"
    - label: "Catalogue"
      value: "500+ poses"
  primaryCta:
    label: "Visit Yoga Platform →"
    href: "https://yoga.daintytrading.com"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "ChefForge"
  href: "/projects/chefforge.html"
nextLink:
  label: "Billing API"
  href: "/projects/billing-api.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "HealthApplication"
  operatingSystem: "Web, iOS, Android"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Most yoga apps are built for the practitioner mid-class. Teachers and serious students need a different shape: dense reference, fast filters, and a way to compose sequences that holds up the next morning when planning a class. We built for that audience.</p>

<h2>What we built</h2>
<p>A monorepo with two front-ends. The web app (Vite + React 18) is the discovery surface — pose pages with anatomy, contraindications, common modifications, and progressions. The mobile app (Expo + React Native, SDK 50) is the on-mat surface — offline-capable, sequence playback, and quick capture for new ideas. Shared TypeScript packages keep types and API contracts identical across both. Supabase provides Postgres, Auth, and Storage in one tier.</p>
<p>The filter set is the unfair advantage. Difficulty, body position, style (hatha, vinyasa, yin, restorative), muscle groups engaged, props required, chakras targeted — combinable, fast, and built on the same indexes the sequence builder uses for “find me a pose that connects these two”.</p>

<h2>The automation angle</h2>
<p>No AI in the product flow today. The interesting automation is in the content pipeline: a CMS-style admin lets teachers contribute poses, and a review queue uses structured checks (image consistency, contraindication completeness, alignment cues) before publishing. The point isn’t LLMs everywhere — it’s shipping a tight, content-rich product, fast.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Yoga teachers</strong> planning classes the night before.</li>
<li><strong>Studio managers</strong> standardising sequence libraries across instructors.</li>
<li><strong>Serious practitioners</strong> who want depth, not gamification.</li>
</ul>

<h2>What it taught us</h2>
<p>That Supabase is a small-team superpower when the product shape is “Postgres with auth on top”. We shipped the first usable version in three weeks because the migration story, the auth story, and the storage story were all decided on day one. The savings paid for the time we spent on the offline-mobile experience — which is the actual differentiator.</p>
