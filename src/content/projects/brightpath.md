---
type: "product"
name: "BrightPath"
title: "BrightPath — Personalised K-12 School with AI Tutor | Dainty Trading"
description: "BrightPath is a personalised online K-12 school with an AI tutor (Pax), gamified rewards, and progress tracking. Built on Next.js and a Node API, powered by Claude and Gemini through OpenRouter."
ogTitle: "BrightPath — AI-tutored K-12 school"
ogDescription: "A personalised online school for K-12 with an AI tutor and gamified progress tracking."
ogImage: "https://daintytrading.com/og/brightpath.png"
lede: "A personalised online school for kindergarten through year twelve. An AI tutor named Pax sits inside every lesson, gamified streaks make showing up the path of least resistance, and dashboards keep parents and teachers honest about progress."
metaChips:
  - label: "Category"
    value: "AI · Education"
  - label: "Stack"
    value: "Next.js · Node · Postgres"
  - label: "LLM"
    value: "OpenRouter (Gemini · Claude)"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/brightpath.png"
  imageWebp: "/screenshots/brightpath.webp"
  alt: "BrightPath screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live · all phases complete"
    - label: "Domain"
      value: "brightpath.school"
    - label: "Frontend"
      value: "Next.js"
    - label: "Backend"
      value: "Node API · Postgres"
    - label: "AI Tutor"
      value: "Pax (Gemini + Claude)"
    - label: "Routing"
      value: "OpenRouter"
    - label: "Audience"
      value: "K-12"
  primaryCta:
    label: "Visit BrightPath →"
    href: "https://brightpath.school"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "ReceiptSnap AI"
  href: "/projects/receiptsnap-ai.html"
nextLink:
  label: "Email Triage"
  href: "/projects/emailtriage.html"
schemaType: "EducationalOrganization"
schemaExtra:
  parentOrganization:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Online learning largely failed because it copied a classroom format that was already failing in person. The shift we wanted to make was simple: every student gets a tutor sitting next to them, every lesson adapts to where the student actually is, and the gamification layer is honest — rewarding mastery, not minutes-on-task.</p>

<h2>What we built</h2>
<p>BrightPath is a full learning environment: a course library spanning maths, literacy, science, history, and electives; an AI tutor (Pax) embedded in every lesson; an XP-and-streak rewards system; and a dashboard for parents that shows what was learned versus what was just clicked through. The frontend is a responsive Next.js app; the backend is a Node API on Postgres; the AI tutor is routed through OpenRouter so we can pick the model with the right cost-quality trade-off per task.</p>

<h2>The AI angle</h2>
<p>Pax has two jobs. The first is reactive — answer the student’s question without giving the answer away when the goal is comprehension. The second is proactive — notice when a student is stuck, surface a hint scaffolded to their level, and adapt the next problem. We use Gemini Flash for the cheap real-time work and Claude for the longer, harder tutoring conversations. Every interaction is logged against the curriculum node, which gives us an evals corpus to keep Pax pedagogically sound.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Homeschool families</strong> use BrightPath as the spine of their week.</li>
<li><strong>Hybrid schools</strong> use the platform between in-person sessions to keep students moving.</li>
<li><strong>Tutoring centres</strong> use the AI tutor as a force multiplier for their human tutors.</li>
</ul>

<h2>What it taught us</h2>
<p>That kids will tell you immediately if your AI tutor is bad. The feedback loop is brutally fast and you cannot hide behind metrics. The single most important investment was the prompt that controls how Pax handles “just tell me the answer” — balancing patience, humour, and the line between scaffolding and stonewalling.</p>

<figure style="margin:40px 0 0;background:var(--bg-elev);border:1px solid var(--border);border-radius:14px;padding:28px;">
<blockquote style="margin:0 0 20px;font-size:15px;line-height:1.7;color:var(--text);">“SATs week and we have been using BrightPath for about 2 weeks now. Ethan just learnt long division, in the space of a day and actually enjoyed the lessons. He asked me why didn’t school teach me this way — the step-by-step guides at the start help so much. Thanks for the help BrightPath team, keep up the good work.”</blockquote>
<figcaption style="font-size:13px;color:var(--text-dim);">
<span style="color:var(--accent-2);">★★★★★</span>&nbsp;
<strong style="color:var(--text);">Neil C</strong> · Parent of an 11-year-old · 2-week follow-up review
</figcaption>
</figure>
