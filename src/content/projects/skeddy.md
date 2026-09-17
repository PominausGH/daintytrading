---
type: "product"
status: "live"
name: "Nudgle"
title: "Nudgle — Telegram Reminder Bot with Natural-Language Scheduling | TelaLoom"
description: "Nudgle is a Telegram reminder bot that listens to plain English. Quiet hours, vacation mode, recurring tasks — all parsed by Claude, stored in Postgres, delivered on time."
ogTitle: "Nudgle — Telegram reminder bot"
ogDescription: "Natural-language scheduling for Telegram, parsed by Claude."
ogImage: "https://telaloom.com/og/skeddy.png"
lede: "A Telegram reminder bot that listens to plain English. Tell Nudgle “remind me to call mum every Sunday at 6pm but not while I’m on holiday,” and it figures out what you meant."
metaChips:
  - label: "Category"
    value: "AI · Bots"
  - label: "Stack"
    value: "Python · Postgres"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/skeddy.png"
  imageWebp: "/screenshots/skeddy.webp"
  alt: "Nudgle reminder bot screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Site"
      value: "nudgle.app"
    - label: "Bot"
      value: "Telegram"
    - label: "Backend"
      value: "Python"
    - label: "Database"
      value: "Postgres"
    - label: "Modes"
      value: "Quiet · Vacation · Recurring"
    - label: "LLM"
      value: "Anthropic Claude"
  primaryCta:
    label: "Visit Nudgle →"
    href: "https://nudgle.app"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Meditation"
  href: "/projects/meditation.html"
nextLink:
  label: "Marketing OS"
  href: "/projects/marketing-os.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "UtilitiesApplication"
  operatingSystem: "Telegram"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Existing reminder apps make you fight a date picker. Existing voice assistants make you fight their grammar. Most of the time the right interface is the chat window already open on your phone — you say what you mean, the bot does the rest.</p>

<h2>What we built</h2>
<p>Nudgle is a Telegram bot that accepts natural-language scheduling and turns it into structured reminders. It supports recurring tasks (“every weekday”, “the last Friday of each month”), per-user timezones, quiet hours, vacation mode, and one-shot reminders with relative dates (“in two hours”, “next Tuesday morning”). Tasks live in Postgres; a worker fires them on time and handles silent windows.</p>

<h2>The AI angle</h2>
<p>Claude does the parsing. The prompt is small, deterministic, and asks for a structured JSON object. We constrain it with a schema and a tight set of examples; the bot only proceeds if the parse round-trips back into a sentence the user agrees with. When the user says “yes that’s right”, both the input and the parse get logged to a regression set we use to vet new prompt versions.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Busy parents</strong> who want to capture a reminder without unlocking another app.</li>
<li><strong>Founders</strong> who already live in Telegram for ops chats.</li>
<li><strong>Teams</strong> using a shared Nudgle bot as a lightweight scheduler for routine pings.</li>
</ul>

<h2>What it taught us</h2>
<p>That natural-language input only works when the bot reflects back what it understood, every time. The single biggest reduction in user errors came from making Nudgle say “OK — reminder set for Tuesday 9pm, repeats weekly. Reply ‘no’ to fix.” before committing. The undo is more important than the parser.</p>

<h2>Why a chat bot instead of a calendar integration</h2>
<p>The tempting build is a Google Calendar sync — more structured, more familiar to build against. We went with a standalone Telegram bot instead, because the entire value proposition is capturing a reminder in the same window you’re already typing in, with zero context switch. A calendar integration means opening a different app, finding the right day, and filling in fields — exactly the friction Nudgle exists to remove. Storing everything in our own Postgres, rather than delegating to a calendar API, is also what makes quiet hours and vacation mode possible: those are business rules about when a reminder is allowed to fire, and they only work if we own the delivery logic end to end rather than handing scheduling off to someone else’s calendar.</p>
