---
type: "product"
status: "live"
name: "CV Matcher"
title: "CV Matcher — AI Job Matching from LinkedIn | Dainty Trading"
description: "CV Matcher scrapes LinkedIn jobs, scores them against your CV with Claude, and explains why each match scored the way it did. Less swipe-fatigue, more actual interviews."
ogTitle: "CV Matcher — AI job matching"
ogDescription: "Score LinkedIn jobs against your CV with explainable AI matching."
ogImage: "https://daintytrading.com/og/cv-matcher.png"
lede: "Upload your CV. CV Matcher scrapes LinkedIn for relevant openings, scores each one against your actual experience with Claude, and tells you in plain English why each match scored the way it did."
metaChips:
  - label: "Category"
    value: "AI · Careers"
  - label: "Stack"
    value: "Python · Flask"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/cv-matcher.png"
  imageWebp: "/screenshots/cv-matcher.webp"
  alt: "CV Matcher screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Domain"
      value: "cvmatcher.work"
    - label: "Backend"
      value: "Python · Flask"
    - label: "Source"
      value: "LinkedIn"
    - label: "LLM"
      value: "Anthropic Claude"
    - label: "Outputs"
      value: "Score + reasoning"
    - label: "Inputs"
      value: "PDF · text CV"
  primaryCta:
    label: "Visit CV Matcher →"
    href: "https://cvmatcher.work"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Everyring.ai"
  href: "/projects/missed-calls.html"
nextLink:
  label: "BizPage Builder"
  href: "/projects/bizpage-builder.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Job boards are optimised for the employer, not the candidate. The result is hundreds of vaguely-relevant postings, no real ranking, and an application process that punishes anyone who isn’t willing to apply to fifty roles a week. We wanted a system that did the reading and ranking, so the human only handled the writing and applying.</p>

<h2>What we built</h2>
<p>CV Matcher takes a CV (PDF or paste-in), extracts a structured profile, and then scrapes LinkedIn for matching openings. Each posting is parsed for explicit and implicit requirements (years, stack, seniority, location, work-rights), scored against the profile, and ranked. The output isn’t just a number — each match comes with a paragraph from Claude explaining the fit and the gap.</p>

<h2>The AI angle</h2>
<p>Two prompts do the heavy lifting. The extractor turns prose CVs and prose job postings into a normalised JSON schema that both sides agree on. The matcher reads the two schemas and produces a score plus a reasoning trace. Keeping these prompts independent means we can iterate on each one in isolation and run a backtest of every change against the user’s past matches.</p>

<h2>Filtering, sorting, and exporting matches</h2>
<p>Once a match runs, a filter bar lets you set a minimum match percentage, select must-have skills from a multi-select populated from that result set, and sort by match score, candidate name, or source file — entirely client-side, no reload. Premium accounts can export the ranked list as CSV (UTF-8 BOM so Excel reads the encoding correctly, skills semicolon-joined so commas never split a column) or XLSX (bold header row, frozen top row, match percentage stored as a real number so it sorts and filters properly in Excel, not as text).</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Active job seekers</strong> who want a daily curated list instead of doom-scrolling LinkedIn.</li>
<li><strong>Career switchers</strong> who use the gap-analysis to decide which skill to add next.</li>
<li><strong>Recruiters and agencies</strong> who use it as a sourcing assistant.</li>
</ul>

<h2>What it taught us</h2>
<p>Explainability changes behaviour. Numerical match scores got users to ignore everything but the top five. The moment we shipped the “why” paragraph, users started exploring matches with mid-range scores — because they could see what was missing and decide whether it actually mattered. That’s the difference between a tool that ranks and a tool that helps you decide.</p>
