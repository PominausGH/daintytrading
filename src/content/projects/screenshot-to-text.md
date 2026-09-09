---
type: "product"
name: "Screenshot to Text"
title: "Screenshot to Text — Dainty Trading"
description: "Production OCR that handles the messy stuff — tables, handwriting, complex layouts — with a high enough accuracy floor that businesses can put it in front of their customers."
ogTitle: "Screenshot to Text"
ogDescription: "Production OCR that handles the messy stuff — tables, handwriting, complex layouts — with a high enough accuracy floor that businesses can put it in front of their customers."
ogImage: "https://daintytrading.com/og/screenshot-to-text.png"
lede: "Production OCR that handles the messy stuff — tables, handwriting, complex layouts — with a high enough accuracy floor that businesses can put it in front of their customers."
metaChips:
  - label: "Category"
    value: "AI · OCR SaaS"
  - label: "Stack"
    value: "Python · Flask · Postgres · Celery"
  - label: "LLM"
    value: "GPT-4 Vision"
  - label: "Status"
    value: "In development"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Site"
      value: "screenshottotext.daintytrading.com"
    - label: "Backend"
      value: "Python · Flask"
    - label: "Workers"
      value: "Celery on Redis"
    - label: "OCR"
      value: "Tesseract + GPT-4 Vision"
    - label: "Storage"
      value: "Cloudflare R2"
    - label: "Billing"
      value: "Stripe"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Recipe API"
  href: "/projects/recipe-api.html"
nextLink:
  label: "Receipt Bridge"
  href: "/projects/receipt-bridge.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Most OCR is good enough for printed paragraphs and useless for everything else. The moment a document has a table, a handwritten signature, a stamp, or a column break, accuracy collapses and someone has to re-key it. For businesses processing thousands of scans a week, that’s a real cost.</p>

<h2>What we’re building</h2>
<p>Screenshot to Text is a Flask-based SaaS that accepts images and PDFs, runs them through a layered pipeline — Tesseract for the easy text, GPT-4 Vision for the hard stuff (tables, handwriting, mixed layouts) — and returns structured output with per-block confidence. Stripe handles billing on a per-page tiered plan. Cloudflare R2 stores the originals.</p>

<h2>The AI angle</h2>
<p>Two-pass extraction. The first pass is deterministic OCR; the second pass uses GPT-4 Vision only on regions the first pass scored below a confidence threshold. This keeps cost down (Vision calls are expensive) while raising the floor on accuracy where it matters.</p>
<p>Routing on confidence rather than running Vision over every page is the part that makes this economical at volume. Most of a typical scan — body paragraphs, standard form fields — is exactly what Tesseract is already good at, so paying for a Vision call there would be pure cost with no accuracy gain. Reserving the expensive model for the regions that actually need it (a table with merged cells, a signature, a stamp overlapping text) is what lets the accuracy floor rise without the per-page cost rising with it.</p>
<p>Per-block confidence scoring is also what makes the output usable downstream rather than just accurate on average. A single page-level confidence score tells an integrator nothing about which fields to trust; per-block scores mean a business can auto-accept the high-confidence fields and route only the uncertain ones to a human, instead of treating every extraction as equally reliable or equally suspect.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Bookkeeping firms</strong> processing client receipts at scale.</li><li><strong>Healthcare admin teams</strong> digitising patient intake forms.</li><li><strong>Legal teams</strong> with handwritten case notes that need to be searchable.</li></ul>

<h2>Where we are</h2>
<p>Core extraction pipeline works. Stripe billing and per-tenant rate limiting are in. Public launch is gated on an SLA we can confidently sell — we’re currently soak-testing against a target of 99.5% per-page accuracy on the standard test set.</p>
