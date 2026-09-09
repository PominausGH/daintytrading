---
type: "product"
name: "AutoArchive"
title: "AutoArchive — Enterprise Shared Mailbox Archiving | Dainty Trading"
description: "AutoArchive backs up 45 shared email boxes to a secure local disk. Each email is saved with its message ID in the filename for instant retrieval — built for a Big 4 Australian bank."
ogTitle: "AutoArchive"
ogDescription: "A personal email archive and search tool that respects your data."
ogImage: "https://daintytrading.com/og/autoarchive.png"
lede: "Built for a Big 4 Australian bank. 45 shared email boxes, backed up four times a day to a secure local disk. Every email saved with its message ID baked into the filename — find anything in seconds, no database required."
metaChips:
  - label: "Category"
    value: "Email · Automation"
  - label: "Client"
    value: "Big 4 Australian bank (name withheld)"
  - label: "Scale"
    value: "45 shared mailboxes"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/autoarchive.png"
  imageWebp: "/screenshots/autoarchive.webp"
  alt: "AutoArchive screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Client"
      value: "Big 4 Australian bank"
    - label: "Mailboxes"
      value: "45 shared"
    - label: "Schedule"
      value: "4x daily backup"
    - label: "Storage"
      value: "Secure local disk"
    - label: "Search"
      value: "Message ID filename"
    - label: "Status"
      value: "Live"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "FocusShield"
  href: "/projects/focusguard.html"
nextLink:
  label: "TimerForge"
  href: "/projects/timerforge.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "UtilitiesApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
          <p>The client runs 45 shared email boxes across teams — compliance, operations, customer service. Each box receives hundreds of messages a day. When a specific email needs to be retrieved for an audit, a dispute, or a compliance review, the question is always the same: where is it, and how fast can you find it? Without a structured archive, the answer is “somewhere, eventually.” That’s not good enough for a bank.</p>

          <h2>What we built</h2>
          <p>AutoArchive connects to all 45 shared mailboxes and runs a backup job four times a day, pulling every email down and writing it to a secure, air-gapped local disk. The key design decision: each file is named using the email’s unique message ID. No database, no index to maintain, no search UI to build — the filesystem <em>is</em> the search. A staff member looking for a specific email pastes the message ID into a file search and has it in under a second.</p>
          <p>The tool handles the full mailbox set in a single run, logs what it backed up and what it skipped, and alerts on failure. It’s designed to be auditable — a compliance team can verify the backup without understanding the code.</p>

          <h2>The automation angle</h2>
          <p>The interesting constraint was reliability over cleverness. A job that touches 45 live mailboxes at a bank, four times a day, cannot fail silently. Every step writes a structured log entry. If a mailbox is unreachable, the job continues with the rest and flags the failure — it doesn’t abort. The result is a system that keeps running even when individual mailboxes have issues, and gives ops a clear picture of exactly what was and wasn’t archived on every run.</p>

          <h2>How it’s used</h2>
          <ul>
            <li><strong>Compliance teams</strong> retrieve specific emails by message ID for audits and regulatory requests.</li>
            <li><strong>Operations staff</strong> recover emails that were deleted or moved from shared boxes.</li>
            <li><strong>IT</strong> verifies backup completeness from the structured run log after every run.</li>
          </ul>

          <h2>What it taught us</h2>
          <p>That the right data structure eliminates the need for a search product. Naming files by message ID means retrieval is a filesystem operation — fast, reliable, and requires no software beyond a file browser. The constraint that felt like a limitation (no database) turned out to be the feature: nothing to maintain, nothing to corrupt, nothing to explain to an auditor.</p>
