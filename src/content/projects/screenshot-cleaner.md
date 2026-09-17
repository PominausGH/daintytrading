---
type: "product"
status: "dev"
name: "ScreenShoot Cleaner"
title: "ScreenShoot Cleaner — TelaLoom"
description: "Drop a folder of messy screenshots and notes, get back a single clean PDF. Auto-crops, deskews, and orders the images, then bundles them with any matching note files into a tidy export."
ogTitle: "ScreenShoot Cleaner"
ogDescription: "Drop a folder of messy screenshots and notes, get back a single clean PDF. Auto-crops, deskews, and orders the images, then bundles them with any matching note files into a tidy export."
ogImage: "https://telaloom.com/og/screenshoot-cleaner.png"
lede: "Drop a folder of messy screenshots and notes, get back a single clean PDF. Auto-crops, deskews, and orders the images, then bundles them with any matching note files into a tidy export."
metaChips:
  - label: "Category"
    value: "Productivity · Automation"
  - label: "Stack"
    value: "Python · Streamlit · OpenCV"
  - label: "LLM"
    value: "—"
  - label: "Status"
    value: "In development"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Site"
      value: "screenshootcleaner.telaloom.com"
    - label: "Backend"
      value: "Python · Streamlit"
    - label: "Image"
      value: "OpenCV"
    - label: "PDF"
      value: "ReportLab"
    - label: "Mode"
      value: "Local-first"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Telegram Crypto Sentiment"
  href: "/projects/telegram-crypto-sentiment.html"
nextLink:
  label: "ReceiptSnap AI"
  href: "/projects/receiptsnap-ai.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Screenshot folders rot. They’re a mix of dimensions, half are off-axis from a phone photo, none of them are in any sensible order, and the few notes that go with them are scattered alongside in different formats. When you actually need to share or archive a batch, “clean it up” takes longer than the original work did.</p>

<h2>What we’re building</h2>
<p>A Streamlit app that takes a folder, runs OpenCV pre-processing (auto-crop, deskew, contrast), pairs each image with any matching <code>.txt</code> or <code>.md</code> notes, sorts by timestamp, and renders the lot as a single ReportLab PDF. The whole thing fits in a single page of Python.</p>

<h2>The automation angle</h2>
<p>No AI here on purpose. The deterministic image pipeline (rotate-by-largest-rect, edge-detect crop, contrast normalisation) handles 95% of the cases. Adding an LLM would slow it down and make it less predictable.</p>
<p>Determinism matters more than it sounds like it should for a screenshot tool. The same input image always produces the same crop and the same rotation, which means a batch of 200 screenshots processes unattended without anyone needing to check the output for the odd model hallucination or an inconsistent call on borderline cases. It also runs entirely offline, which matters for the actual content of most screenshot folders — error messages with account details in them, internal dashboards, draft documents — none of which needs to leave the machine to get cleaned up.</p>

<h2>Ordering and pairing</h2>
<p>The timestamp-sort step does more work than it looks like. Screenshots taken minutes apart during the same research session need to land in the order they were actually looked at, not the order the filesystem happens to list them in — and the note-pairing logic has to match a <code>.txt</code> or <code>.md</code> file to its screenshot by proximity in time rather than by filename, since almost nobody names their scratch notes to match their screenshots. Getting that pairing wrong is worse than not pairing at all, because a mismatched note reads as authoritative when it isn’t.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Researchers and students</strong> assembling reading-and-annotation packs.</li><li><strong>Designers</strong> bundling reference shots and rationale notes for a client review.</li><li><strong>Anyone with a screenshots folder they’ve been avoiding.</strong></li></ul>

<h2>Where we are</h2>
<p>Working tool, used daily inside the studio. Public release is a polish pass — better defaults, drag-and-drop on the Streamlit page, and an option to push the resulting PDF straight into Paperless-NGX.</p>
