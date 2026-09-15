---
type: "product"
status: "live"
name: "Solar Loan Reconciler"
title: "Solar Loan Reconciler — Automated Weekly Payout Matching | Dainty Trading"
description: "Automated Friday reconciliation system for a financial company's solar loan payouts. Collects daily CSVs Mon–Fri, matches them against the weekly Loan Payout Report, flags unmatched IDs, and emails a clean HTML report to the loans team."
ogTitle: "Solar Loan Reconciler"
ogDescription: "Automated Friday reconciliation system that eliminates missed solar loan payouts for a financial company."
ogImage: "https://daintytrading.com/og-card.jpg"
lede: "Built for a financial company to eliminate missed solar loan payouts. Every Friday, the system collects a week’s worth of transaction CSVs, matches them against the Loan Payout Report, flags any IDs that don’t line up, and emails a clean HTML report directly to the loans team — automatically, without anyone touching it."
metaChips:
  - label: "Category"
    value: "Finance · Automation"
  - label: "Client"
    value: "Financial company"
  - label: "Schedule"
    value: "Every Friday"
  - label: "Status"
    value: "Live"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Client"
      value: "Financial company"
    - label: "Data sources"
      value: "5 daily CSVs + report"
    - label: "Schedule"
      value: "Automated every Friday"
    - label: "Output"
      value: "HTML email report"
    - label: "Match method"
      value: "DataFrame lookup"
    - label: "Status"
      value: "Live"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "ConvoForge"
  href: "/projects/convoforge.html"
nextLink:
  label: "Meditation"
  href: "/projects/meditation.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>The client had a recurring problem: loans slipping through the cracks. The loans team was manually cross-referencing daily transaction files against a weekly payout report, and the process was error-prone enough that one missed payout had already triggered a due notice. That was the incident that kicked off this project.</p>
<p>The root cause wasn’t negligence — it was volume and format mismatch. Five separate CSV files arriving on different days, one consolidated report arriving on Friday, and no automated way to reconcile them. Something was always going to get missed.</p>

<h2>What we built</h2>
<p>Every Monday to Friday, transaction data arrives by email as CSV attachments. The system collects all five daily files automatically, including the Friday CSV. Also on Friday, the Loan Payout Report arrives.</p>
<p>Once the application has confirmed it holds the full week — five daily CSVs and the Loan Payout Report — it runs the reconciliation. All daily CSVs are imported into a single DataFrame. The Loan Payout Report is imported into a second. The system then performs a comprehensive lookup across both: every ID in the payout report is checked against the transaction data. Any ID that doesn’t match is flagged.</p>
<p>The output is a clean, professional HTML table containing every unmatched payout. That table is emailed directly to the loans team so they can action outstanding payouts the same day, before the weekend.</p>

<h2>The automation angle</h2>
<p>The key design constraint was zero manual steps. No one should need to download files, open spreadsheets, or run a script. The system watches for the emails, collects the attachments, waits until the full week’s data is present, runs the match, and fires the report — all without intervention.</p>
<p>The HTML email format was a deliberate choice. The loans team receives a report they can act on immediately without downloading anything or opening a separate tool. The flagged IDs are right there in their inbox, formatted for quick scanning.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Loans team</strong> receives the Friday report in their inbox and works through any flagged IDs the same afternoon.</li>
<li><strong>Management</strong> has a weekly paper trail showing which payouts were reconciled and which required manual follow-up.</li>
<li><strong>Operations</strong> no longer manually touch any files — the process runs entirely on autopilot.</li>
</ul>

<h2>The result</h2>
<p>Since the system went live, the client has had zero missed loan payouts. The Friday reconciliation that previously required manual effort and was prone to error now runs on autopilot every week. The loans team receives a clear, actionable report rather than a pile of spreadsheets to compare by hand.</p>

<blockquote>
<p>“This solar project completely transformed how we handle our loan payouts. Before this solution, we had a recurring problem where loans would slip through the cracks. One missed payout led to a due notice, which is why this project was built. Since implementing this automated Friday process, we’ve eliminated missed loans entirely. The weekly reconciliation is now reliable, efficient, and runs on autopilot every Friday — saving significant time and removing the risk of human error.”</p>
<cite>— Client, Financial Company</cite>
</blockquote>
