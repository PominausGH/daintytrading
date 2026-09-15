---
type: "product"
status: "testing"
name: "Tax Prep"
title: "Tax Prep — All Your Tax Documents in One Place | Dainty Trading"
description: "Tax Prep collates every receipt, statement, deduction, and slip into one organised vault — so tax time is a half-hour handover, not a weekend of folders."
ogTitle: "Tax Prep — easier tax time"
ogDescription: "Collates all tax documents in one searchable, year-tagged vault."
ogImage: "https://daintytrading.com/og/tax-prep.png"
lede: "A vault for everything your accountant will eventually ask for. Drop in receipts, bank statements, payslips, deduction slips, and dividend notices throughout the year — AI categorises and tags each one — and tax time becomes a single export instead of a weekend of folders."
metaChips:
  - label: "Category"
    value: "AI · Personal finance"
  - label: "Stack"
    value: "Next.js · FastAPI · Postgres"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In final testing"
    - label: "Site"
      value: "taxprep.daintytrading.com"
    - label: "Frontend"
      value: "Next.js"
    - label: "Backend"
      value: "Python · FastAPI"
    - label: "Database"
      value: "Postgres"
    - label: "OCR"
      value: "Tesseract + Claude"
    - label: "LLM"
      value: "Anthropic Claude"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "ChatVault"
  href: "/projects/chatvault.html"
nextLink:
  label: "Second Brain"
  href: "/projects/second-brain.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "FinanceApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Tax prep isn’t hard because the maths is hard. It’s hard because the inputs are scattered across a year of inboxes, banking apps, photos of crumpled receipts, and PDFs from three different brokers. By the time it’s due, half a Saturday goes to assembling the pile before any actual returns get filled.</p>

<h2>What we’re building</h2>
<p>Tax Prep is a single drop-zone for every document that might matter at tax time. Forward an email, drag a PDF, snap a receipt — everything lands in a vault organised by tax year and category. Documents are OCR’d, classified (income / deductible / capital gains / super / charitable / medical), and tagged with the relevant amounts and dates. At year-end, one export gives your accountant a complete, structured handover.</p>

<h2>The AI angle</h2>
<p>Claude does the classification. Each new document goes through OCR, then a structured prompt that returns category, dollar amount, date, counter-party, and a confidence score. Low-confidence items go to a small review queue you triage in batches. Confidence calibrates over time as you accept or correct the model’s guesses — the system learns your specific deduction categories the same way a long-running accountant learns them.</p>

<h2>How it’ll be used</h2>
<ul>
<li><strong>Sole traders and contractors</strong> who track receipts in three places and lose two of them.</li>
<li><strong>Investors</strong> with brokerage statements, dividends, and capital-gains events that need cross-referencing.</li>
<li><strong>Anyone with a complex personal return</strong> who wants tax time to be a half-hour handover, not a weekend.</li>
</ul>

<h2>Where we are</h2>
<p>OCR + classification is working. Email forwarding, manual upload, and bank-statement parsing are in. The next milestone is the year-end export — a single bundle in the format your accountant prefers (CSV, PDF, or a hand-shake with their software). Expected public beta around the next financial year crossover.</p>
