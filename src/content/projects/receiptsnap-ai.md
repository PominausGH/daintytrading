---
type: "product"
status: "dev"
name: "ReceiptSnap AI"
title: "ReceiptSnap AI — TelaLoom"
description: "Native iOS and Android receipt scanner with on-device capture, cloud OCR, and a tidy expense log. Designed for solo operators who want speed at the till and structured data afterwards, without an SaaS subscription."
ogTitle: "ReceiptSnap AI"
ogDescription: "Native iOS and Android receipt scanner with on-device capture, cloud OCR, and a tidy expense log. Designed for solo operators who want speed at the till and structured data afterwards, without an SaaS subscription."
ogImage: "https://telaloom.com/og/receiptsnap-ai.png"
lede: "Native iOS and Android receipt scanner with on-device capture, cloud OCR, and a tidy expense log. Designed for solo operators who want speed at the till and structured data afterwards, without an SaaS subscription."
metaChips:
  - label: "Category"
    value: "AI · Mobile"
  - label: "Stack"
    value: "Swift/SwiftUI · Kotlin/Jetpack Compose · Firebase"
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
      value: "receiptsnap.telaloom.com"
    - label: "iOS"
      value: "Swift · SwiftUI"
    - label: "Android"
      value: "Kotlin · Jetpack Compose"
    - label: "Backend"
      value: "Firebase"
    - label: "OCR"
      value: "Google Cloud Vision"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "ScreenShoot Cleaner"
  href: "/projects/screenshot-cleaner.html"
nextLink:
  label: "WiseKeel"
  href: "/projects/wisekeel.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Receipt-tracking apps either bury the user in features they don’t want (multi-currency travel reports, team approval flows, subscription tiers) or are so basic they don’t actually save the data anywhere structured. There’s a gap for solo operators — tradies, freelancers, sole traders — who want a fast camera button and a clean export at year-end.</p>

<h2>What we’re building</h2>
<p>ReceiptSnap AI is a native app on both platforms (Swift/SwiftUI on iOS, Kotlin + Jetpack Compose on Android). The capture flow is optimised for one-handed use at the till. Google Cloud Vision runs OCR; results sync to Firebase; an export bundles the year as CSV plus original images for your accountant.</p>

<h2>The AI angle</h2>
<p>OCR alone isn’t enough — the value is in the post-OCR cleanup. We extract structured fields (vendor, date, total, GST, line items) and confidence-score each one. Low-confidence fields surface for one-tap correction. Over time the model learns the user’s common vendors and pre-fills with high accuracy.</p>
<p>GST is its own field rather than something derived after the fact, because Australian sole traders need it broken out separately at BAS time and a total-only receipt forces someone to reconstruct the split later from a faded thermal-paper photo. Extracting it at capture, while the receipt is still legible, is strictly easier than reconstructing it in July.</p>

<h2>Why native over cross-platform</h2>
<p>A cross-platform framework would have shipped faster, but the capture flow is the one part of this app where speed and camera behaviour actually matter — autofocus latency, shutter feel, how quickly the app is ready after being opened one-handed at a till with a queue behind you. Those are exactly the things a cross-platform camera layer tends to compromise on. Building twice, once per platform, was the cost of not compromising on the one interaction the whole app exists to make fast.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Tradies and contractors</strong> capturing job-related expenses on the go.</li><li><strong>Freelancers and sole traders</strong> who do their own books.</li><li><strong>Travel-heavy professionals</strong> who want every receipt logged before the day ends.</li></ul>

<h2>Where we are</h2>
<p>iOS build is in TestFlight. Android build is following close behind. Public release is gated on the year-end export hitting the format conventions of common accounting software.</p>
