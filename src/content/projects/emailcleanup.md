---
type: "product"
name: "Email Cleanup"
title: "Email Cleanup — Bulk Email Domain Validation API | Dainty Trading"
description: "Email Cleanup is a FastAPI service for bulk email validation. Detects disposable providers, validates domains, and gives you a single endpoint for keeping your mailing lists healthy."
ogTitle: "Email Cleanup"
ogDescription: "FastAPI service for bulk email domain validation and disposable-provider detection."
ogImage: "https://daintytrading.com/og/emailcleanup.png"
lede: "A small, fast API that validates email addresses, flags disposable providers, and gives you a single endpoint for keeping mailing lists clean. Simple stack, simple price."
metaChips:
  - label: "Category"
    value: "Tools · API"
  - label: "Stack"
    value: "Python · FastAPI · SQLite"
  - label: "Status"
    value: "Live"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Domain"
      value: "emailcleanup.daintytrading.com"
    - label: "Backend"
      value: "Python · FastAPI"
    - label: "Database"
      value: "SQLite"
    - label: "Templating"
      value: "Jinja2"
    - label: "Latency"
      value: "< 20ms p95"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Email Triage"
  href: "/projects/emailtriage.html"
nextLink:
  label: "Subscription Incinerator"
  href: "/projects/subscription.html"
schemaType: "WebAPI"
schemaExtra:
  provider:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
          <p>Mailing-list hygiene is the most-deferred maintenance task in marketing. Bouncebacks tank deliverability; disposable-email signups poison conversion data; the existing “email verification” vendors charge per check at scale. We wanted a self-hostable, single-endpoint service that solved 90% of the problem cheaply.</p>

          <h2>What we built</h2>
          <p>Email Cleanup is a FastAPI service backed by SQLite. It maintains a curated <code>domains.txt</code> of known disposable, role, and parked providers; runs deterministic syntax and MX-record checks; and answers a single <code>POST /validate</code> with a structured verdict per address. Bulk endpoints accept lists and stream results back as soon as each one resolves.</p>

          <h2>The automation angle</h2>
          <p>The domain list is the product. We auto-update it from public disposable-domain feeds with a manual review queue, and accept user-flagged domains via a single endpoint. There’s no LLM here; there doesn’t need to be. Pattern matching with good source data beats clever models for the cost-per-call this product targets.</p>

          <h2>How it’s used</h2>
          <ul>
            <li><strong>SaaS signups</strong> rejecting disposable inboxes before they pollute the funnel.</li>
            <li><strong>Email senders</strong> cleaning lists before a campaign goes out.</li>
            <li><strong>Internal tools</strong> across our portfolio that need a fast yes/no.</li>
          </ul>

          <h2>What it taught us</h2>
          <p>Not every product needs AI to be valuable. Sometimes the win is a tight schema, a maintained data file, and a service that responds in under twenty milliseconds. We use Email Cleanup ourselves — it’s the kind of unsexy infrastructure that quietly improves every other product.</p>
