---
type: "product"
status: "live"
name: "FocusShield"
title: "FocusShield — Cross-Platform Focus & Task App | Dainty Trading"
description: "FocusShield is a cross-platform task and focus app — web, iOS, Android — with productivity analytics and a Postgres backend. Built on Expo and React Native."
ogTitle: "FocusShield"
ogDescription: "Cross-platform task and focus app with real productivity analytics."
ogImage: "https://daintytrading.com/og/focusguard.png"
lede: "A cross-platform task and focus app that runs on web, iOS, and Android from a single codebase. Capture work, time the deep blocks, and see honest analytics over weeks — not just streaks for streaks’ sake."
metaChips:
  - label: "Category"
    value: "Productivity · Mobile"
  - label: "Stack"
    value: "React Native · Expo · Node · Postgres"
  - label: "Auth"
    value: "JWT"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/focusguard.png"
  imageWebp: "/screenshots/focusguard.webp"
  alt: "FocusShield screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live (multi-platform)"
    - label: "Domain"
      value: "focusshield.app"
    - label: "Mobile"
      value: "Expo SDK 54"
    - label: "API"
      value: "Node · Express"
    - label: "Database"
      value: "Postgres"
    - label: "Auth"
      value: "JWT"
    - label: "Targets"
      value: "iOS · Android · Web"
  primaryCta:
    label: "Visit FocusShield →"
    href: "https://focusshield.app"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "BizPage Builder"
  href: "/projects/bizpage-builder.html"
nextLink:
  label: "AutoArchive"
  href: "/projects/autoarchive.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "ProductivityApplication"
  operatingSystem: "iOS, Android, Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>The market is flooded with task apps and timer apps; almost none of them are honest about what they measure. Most reward you for opening the app, not for getting the work done. We wanted a tool that ranked sessions by depth and surfaced the kind of analytics you’d want before a quarterly review — not the kind that show up on a dopamine dashboard.</p>

<h2>What we built</h2>
<p>FocusShield is built once on Expo SDK 54 and ships to iOS, Android, and the web. The Node and Express backend handles auth (JWT), task CRUD, and the analytics roll-ups; Postgres is the source of truth. The mobile experience and the desktop experience are deliberately the same shape — one task list, one timer, one weekly view — because context-switching between layouts kills retention more than any missing feature.</p>

<h2>The automation angle</h2>
<p>FocusShield isn’t LLM-heavy by design; the value is in the discipline of measurement. Where automation does help: weekly digest emails (“here’s where your hours actually went”), smart breaks based on session length, and an opt-in summary that turns a week of session metadata into one paragraph you can paste into a status update.</p>

<h2>The meeting cost calculator</h2>
<p>The feature that surprises people most isn’t the timer — it’s the meeting cost calculator. Enter attendee count and an average salary, hit start, and it shows the running cost per minute and per hour for the meeting you’re actually sitting in, with start/stop/reset controls and a shareable summary at the end. The focus timer itself ships three presets out of the box — Classic (25/5/15), Deep Work (50/10/20), and Sprint (15/5/15) — each linkable to a specific task, with a session-history calendar and CSV export for anyone who wants their own analytics rather than trusting ours.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Solo operators</strong> tracking deep work alongside running a business.</li>
<li><strong>Knowledge workers</strong> who want to know whether yesterday was actually productive.</li>
<li><strong>Students</strong> who need to time-box study without becoming hostage to a Pomodoro cult.</li>
</ul>

<h2>What it taught us</h2>
<p>Cross-platform via Expo is genuinely a force multiplier for a small team if you’re willing to keep the surface area lean. The moment you start chasing platform-specific feel, the savings disappear. We picked “same shape, native polish” and have shipped twelve releases without a fork.</p>
