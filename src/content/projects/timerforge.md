---
type: "product"
status: "live"
name: "TimerForge"
title: "TimerForge — Cross-Platform Countdown Timer SaaS | TelaLoom"
description: "TimerForge is a countdown timer that ships as a Windows/Mac/Linux desktop app and a web SaaS. Embeddable, shareable, billed by Stripe. Built on PyQt6 and Node."
ogTitle: "TimerForge"
ogDescription: "Cross-platform countdown timer — desktop and web — embeddable and shareable."
ogImage: "https://telaloom.com/og/timerforge.png"
lede: "A countdown timer that takes itself seriously. Native desktop apps for Windows, Mac, and Linux. A web SaaS for embedding and sharing. Stripe-billed pro features. The kind of small product that quietly compounds."
metaChips:
  - label: "Category"
    value: "SaaS · Cross-platform"
  - label: "Stack"
    value: "PyQt6 · Node · Express · Nginx"
  - label: "Billing"
    value: "Stripe"
  - label: "Status"
    value: "Live"
screenshot:
  image: "/screenshots/timerforge.png"
  imageWebp: "/screenshots/timerforge.webp"
  alt: "TimerForge screenshot"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Domain"
      value: "timerforge.app"
    - label: "Desktop"
      value: "PyQt6 · PyInstaller"
    - label: "Web"
      value: "Node · Express"
    - label: "Reverse proxy"
      value: "Nginx"
    - label: "Billing"
      value: "Stripe"
    - label: "Targets"
      value: "Win · Mac · Linux · Web"
  primaryCta:
    label: "Visit TimerForge →"
    href: "https://timerforge.app"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "AutoArchive"
  href: "/projects/autoarchive.html"
nextLink:
  label: "Ghost Writer"
  href: "/projects/ghost-writer.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "UtilitiesApplication"
  operatingSystem: "Windows, macOS, Linux, Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Free timer tools dominate search and disrespect the user. Ad-stuffed pages, settings that don’t persist, no way to share or embed, no offline mode. There’s a real audience — teachers, broadcasters, event runners, fitness coaches — willing to pay a small amount for a timer that just works. We built for them.</p>

<h2>What we built</h2>
<p>TimerForge ships in two forms. The desktop app is built in Python with PyQt6 and packaged for Windows, macOS, and Linux via PyInstaller — one binary per platform, signed, auto-updating. The web SaaS is a Node and Express service with embeddable timer widgets, shareable URLs, persistent presets, branding controls, and Stripe-billed pro features (large displays, custom themes, scheduled timers, multi-device sync).</p>

<h2>The automation angle</h2>
<p>The interesting work was in the build and release pipeline. Each platform has different signing, notarisation, and packaging quirks; the CI pipeline handles all three from a single push. The web SaaS deploys behind Nginx with Stripe webhooks for licence activation, so a user buying on the marketing site is upgraded everywhere within seconds.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Teachers</strong> running test timers on a projector.</li>
<li><strong>Streamers and broadcasters</strong> embedding countdowns in OBS scenes.</li>
<li><strong>Event runners</strong> pacing keynotes without an AV crew.</li>
<li><strong>Fitness coaches</strong> running intervals.</li>
</ul>

<h2>What it taught us</h2>
<p>Cross-platform desktop is a real product surface in 2026 if you’re willing to do the boring work. The boring work — code signing, notarisation, auto-update, crash reporting — is the moat. Once it’s done, releases cost almost nothing and the surface is yours.</p>

<h2>Two codebases, one product</h2>
<p>The desktop app and the web SaaS are genuinely separate applications — PyQt6 on the desktop, Node and Express on the web — not one codebase compiled two ways. That was a deliberate call: a countdown timer on a desktop needs to survive without a network connection and feel native to each OS’s window chrome, while the web version needs to be embeddable in an iframe and share instantly by URL. Trying to force both out of one codebase would have meant compromising on whichever platform lost the argument. Keeping them separate means each can lean into what its platform is actually good at, at the cost of keeping feature parity a deliberate decision rather than something the build system gives you for free.</p>
<p>What ties them together is Stripe. A pro licence purchased on the web unlocks the same entitlement on desktop, checked against the same subscription record — the product is two apps, but the account is one.</p>
