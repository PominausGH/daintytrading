---
type: "product"
status: "live"
name: "Ghost Writer"
title: "Ghost Writer — AI Article Generation & Auto-Publishing | TelaLoom"
description: "Ghost Writer is an end-to-end content engine. It detects trending topics on Hacker News, Reddit, and Dev.to, drafts 1,500-word articles with Claude, runs six quality gates, and auto-publishes to LinkedIn and Medium."
ogTitle: "Ghost Writer — AI content engine"
ogDescription: "Trend detection, article generation, six-layer quality checks, multi-platform publishing — fully automated."
ogImage: "https://telaloom.com/og/ghost-writer.png"
lede: "An end-to-end content engine. Trend detection, AI drafting, multi-layer quality control, and automated publishing to LinkedIn and Medium — with a human only in the loop when something looks off."
metaChips:
  - label: "Category"
    value: "AI · Content automation"
  - label: "Stack"
    value: "Python · Flask · SQLite"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/ghost-writer.png"
  imageWebp: "/screenshots/ghost-writer.webp"
  alt: "Ghost Writer screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Domain"
      value: "signalreads.com"
    - label: "Backend"
      value: "Python · Flask"
    - label: "Sources"
      value: "HN · Reddit · Dev.to"
    - label: "Targets"
      value: "LinkedIn · Medium"
    - label: "Quality gates"
      value: "Six"
    - label: "LLM"
      value: "Anthropic Claude"
    - label: "Orchestration"
      value: "GitHub Actions"
  primaryCta:
    label: "Visit Ghost Writer →"
    href: "https://signalreads.com"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "TimerForge"
  href: "/projects/timerforge.html"
nextLink:
  label: "Meditation"
  href: "/projects/meditation.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
    url: "https://telaloom.com"
---

<h2>The problem</h2>
<p>Owned-media works, but only for people who can publish weekly without burning out. Most builders, founders, and consultants have plenty to say and zero capacity to write it down on a schedule. We wanted a pipeline that handled the unsexy 80% — topic research, structure, draft, polish, scheduling — while leaving the editorial taste at the start (what topic) and the end (does this go out as-is).</p>

<h2>What we built</h2>
<p>Ghost Writer scrapes Hacker News, Reddit, and Dev.to on a cron, scores topics for relevance against a per-account profile, and queues the winners for drafting. Claude writes a 1,500-word article in the configured voice with structured sections and a working hook. The draft passes through six independent quality gates — grammar, originality, AI-detector resistance, on-page SEO, link integrity, and brand-voice match — and only ships if all six pass.</p>
<p>Publishing happens through the LinkedIn and Medium APIs with rate limiting, retry, and human approval as an optional gate. A Flask dashboard shows the pipeline live: topic queue, draft status, QA results, scheduled posts, and historical performance pulled back from each platform.</p>

<h2>The AI angle</h2>
<p>Generation is the easy part. The hard part is the QA pipeline. We treat each quality check as a small, focused Claude call with its own prompt and pass/fail rubric, and we keep the prompts versioned in Git with a regression test set of articles that should pass and articles that shouldn’t. Every change to a prompt has to keep the matrix green before it ships. That’s how we keep quality from drifting as Claude itself changes underneath us.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Solo operators</strong> get a publishing cadence they couldn’t maintain by hand.</li>
<li><strong>Agencies</strong> use it as a draft factory, with their writers becoming editors instead of typists.</li>
<li><strong>Personal-brand builders</strong> stay top-of-feed without giving up their evenings.</li>
</ul>

<h2>What it taught us</h2>
<p>That AI content only earns trust when the failure modes are visible. The dashboard makes the rejected drafts as prominent as the published ones — you can read why a piece failed AI-detector or originality and what the draft looked like. Hiding the misses would have been faster to build and slower to win confidence.</p>
