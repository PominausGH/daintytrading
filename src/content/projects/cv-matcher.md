---
type: "product"
status: "live"
name: "CV Matcher"
title: "CV Matcher — AI CV Screening for Recruitment Agencies | TelaLoom"
description: "CV Matcher ranks every CV against a job description with Claude — a match score, matched and missing skills, and a one-line reason per candidate. Built for recruitment agencies and in-house recruiters."
ogTitle: "CV Matcher — AI CV screening"
ogDescription: "Rank hundreds of CVs against a job description with explainable AI scoring."
ogImage: "https://telaloom.com/og/cv-matcher.png"
lede: "Post a job, upload a stack of CVs. CV Matcher scores every candidate against the role with Claude and tells you in plain English which skills matched, which are missing, and why."
metaChips:
  - label: "Category"
    value: "AI · Recruitment"
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
    - label: "Data"
      value: "SQLite"
    - label: "LLM"
      value: "Claude Haiku 4.5"
    - label: "Outputs"
      value: "Score · skills · reason"
    - label: "Inputs"
      value: "CVs + job description"
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
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>A single job ad can pull in hundreds of CVs, and a recruiter still has to read each one to find the handful worth a phone call. Keyword filters miss good candidates who describe the same skill differently, and a bare score doesn’t tell you what’s actually missing. We wanted a tool that did the first-pass reading and ranking, so the recruiter only spent time on the shortlist.</p>

<h2>What we built</h2>
<p>Recruiters post a job description and upload CVs in bulk. CV Matcher scores every candidate against the role and ranks them, and each result comes with the skills that matched, the skills that are missing, and a one-line reason for the score. On top of screening, it can suggest interview questions for a shortlisted candidate and help source new candidates from LinkedIn and GitHub. Teams can share jobs and results across seats.</p>

<h2>The AI angle</h2>
<p>Scoring is one narrowly-scoped Claude Haiku call per CV and job pair. The model must return a fixed JSON shape — score, matched skills, missing skills, and a short reason — and the app strips stray formatting, clamps the score to 0–100, and caps the skill lists before anything is stored. If the model call fails or returns something unparseable, scoring falls back to a deterministic TF-IDF and keyword-overlap score, so a candidate never ends up with a half-parsed result.</p>

<h2>Filtering, sorting, and exporting matches</h2>
<p>Once a match runs, a filter bar lets you set a minimum match percentage, select must-have skills from a multi-select populated from that result set, and sort by match score, candidate name, or source file — entirely client-side, no reload. Premium accounts can export the ranked list as CSV (UTF-8 BOM so Excel reads the encoding correctly, skills semicolon-joined so commas never split a column) or XLSX (bold header row, frozen top row, match percentage stored as a real number so it sorts and filters properly in Excel, not as text).</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Recruitment agencies</strong> screening high-volume applications across several open roles.</li>
<li><strong>In-house recruiters and hiring managers</strong> who want a ranked shortlist with the gaps spelled out before the first call.</li>
<li><strong>Small teams</strong> sharing jobs and results across seats instead of passing CVs around by email.</li>
</ul>

<h2>What it taught us</h2>
<p>A score on its own isn’t enough to act on. Showing the matched and missing skills next to every score lets a recruiter judge whether a gap actually matters for the role — which is the difference between a tool that ranks and a tool that helps you decide. And because the AI call has a deterministic fallback, screening keeps working even when the model doesn’t.</p>
