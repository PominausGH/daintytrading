---
type: "product"
status: "dev"
name: "Receipt Bridge"
title: "Receipt Bridge — TelaLoom"
description: "Field workers text a photo of a receipt to a shared number. OCR extracts the data automatically and surfaces it in a finance dashboard. No paper, no manual entry, no missed reimbursements."
ogTitle: "Receipt Bridge"
ogDescription: "Field workers text a photo of a receipt to a shared number. OCR extracts the data automatically and surfaces it in a finance dashboard. No paper, no manual entry, no missed reimbursements."
ogImage: "https://telaloom.com/og/receipt-bridge.png"
lede: "Field workers text a photo of a receipt to a shared number. OCR extracts the data automatically and surfaces it in a finance dashboard. No paper, no manual entry, no missed reimbursements."
metaChips:
  - label: "Category"
    value: "AI · Field operations"
  - label: "Stack"
    value: "Django 5 · Celery · Postgres"
  - label: "LLM"
    value: "Google Cloud Vision"
  - label: "Status"
    value: "In development"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Site"
      value: "receiptbridge.telaloom.com"
    - label: "Backend"
      value: "Django 5"
    - label: "Workers"
      value: "Celery on Redis"
    - label: "Ingest"
      value: "Twilio (SMS/MMS)"
    - label: "OCR"
      value: "Google Cloud Vision"
    - label: "Storage"
      value: "AWS S3"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Screenshot to Text"
  href: "/projects/screenshot-to-text.html"
nextLink:
  label: "Prompt Builder"
  href: "/projects/prompt-builder.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Field-based teams accumulate paper receipts. The receipts get lost in vehicles, washed in pockets, or photographed and forgotten in a camera roll. Finance ends up chasing them at month-end. Existing “receipt scanning” apps require an app install, an account, and a habit — three things tradies, drivers, and field reps don’t want.</p>

<h2>What we’re building</h2>
<p>Receipt Bridge gives the team a single SMS number. Workers text a photo of the receipt; that’s the entire UX. Twilio receives, our Django backend kicks off a Celery job that runs Google Cloud Vision to extract vendor, date, total, and line items, and the structured record lands in a finance dashboard for review. Originals go to S3 with retention rules.</p>

<h2>The AI angle</h2>
<p>Receipt OCR is a solved problem when receipts behave. Real-world receipts — faded thermal paper, oblique angles, glare, half-folded — are not solved. We feed the raw OCR plus the original image into a quick verification step that catches obvious mistakes (totals that don’t add up, vendor names misread as nonsense) before they hit the dashboard.</p>
<p>The SMS-only interface is the actual product decision, not a shortcut. Every field worker already has a phone that can send an MMS; none of them are going to install an app, remember a password, or open a browser mid-job to log a $12 fuel receipt. Twilio receiving the photo and Celery picking it up asynchronously means the worker’s phone is free the moment the message sends — there’s no spinner to wait on, no confirmation screen, nothing that turns a two-second task into a thirty-second one. If OCR fails or the verification step flags a mismatch, the record still lands in the dashboard, just marked for a human glance rather than silently dropped — a receipt worth reimbursing should never disappear because a scan came out blurry.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Trades businesses</strong> with multiple vans on the road.</li><li><strong>Sales teams</strong> with travelling reps and per-diem expenses.</li><li><strong>Property managers</strong> with maintenance contractors submitting reimbursable receipts.</li></ul>

<h2>Where we are</h2>
<p>SMS ingest, OCR, and the review dashboard are working. Next milestone is exports to common bookkeeping formats (Xero, MYOB, QuickBooks) so finance can clear the queue with a single button.</p>
