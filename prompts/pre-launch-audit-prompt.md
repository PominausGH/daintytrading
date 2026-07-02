# Pre-Launch Audit Prompt — daintytrading.com

Tailored for a static HTML brochure/portfolio site for a single-location
Australian AI automation studio. No SPA, no e-commerce, no multi-language
i18n, no IP-based redirects — do not assume these exist.

---

## Prompt

You are a senior full-stack web developer, SEO/GEO specialist, and pre-launch
auditor with 15+ years shipping production marketing sites. Perform a
comprehensive, honest audit of https://daintytrading.com.

Context you must not contradict without evidence:
- This is a static HTML site (no JS framework/SPA) for Dainty Trading, an
  Australian AI automation studio (Sydney / Central Coast, NSW).
- It already ships `llms.txt`, a `robots.txt` with explicit AI-crawler allow
  rules (GPTBot, ClaudeBot, PerplexityBot, etc.), and JSON-LD for
  Organization, WebSite, ItemList (37 products), and FAQPage.
- "Geo" on this site means five separate static local-SEO landing pages
  (`/australia.html`, `/sydney.html`, `/central-coast.html`, `/uk.html`,
  `/usa.html`), each with its own canonical tag — not hreflang/i18n/currency
  switching. There is no language selector and no IP-based redirect.
- "GEO" means **Generative Engine Optimization** (visibility and accurate
  citation in ChatGPT, Perplexity, Google AI Overviews) — not geographic
  localization. Keep these two concepts separate in your output.

Crawl and review: homepage, services page, about, contact (form + validation
+ spam protection), the 5 location pages, blog index + posts, project/product
pages, privacy page, 404 page, sitemap.xml, robots.txt, llms.txt.

Structure your response with these sections, prioritizing findings Critical
> High > Medium > Low, quoting exact text/URLs:

1. **Overall Impression** — production-ready verdict, biggest strength,
   biggest risk. Scores /10 for: Functionality, Content, Performance, SEO,
   GEO/AI-visibility, Accessibility, Security, Local SEO.

2. **Functionality** — nav, links, the contact form's validation/submission/
   spam-protection, any console errors. Note this is static HTML: don't
   invent SPA-only failure modes (routing, state loops) that can't occur.

3. **Content & Copy** — grammar, tone consistency across the 5 location
   pages vs. homepage, placeholder/outdated text, duplicate or thin content
   risk between the near-identical location pages.

4. **Design & Responsive** — mobile/tablet/desktop layout, consistency of
   fonts/buttons/spacing across pages.

5. **Performance** — expected Core Web Vitals, image optimization (note
   several PNGs in repo root are multi-MB — check if they're actually
   served vs. optimized webp), caching/compression, CDN.

6. **SEO** — title tags, meta descriptions, H1 structure, canonical tags
   (verify each location page's canonical points to itself, not homepage),
   URL cleanliness, sitemap/robots correctness.

7. **GEO / AI Visibility** (Generative Engine Optimization) — evaluate
   against: entity clarity in first paragraph, FAQ coverage matching real
   prospect questions, quotable/citable declarative sentences, JSON-LD
   correctness (validate against Google's Rich Results Test), consistency
   between on-page claims and llms.txt, whether the AI-crawler allow rules
   in robots.txt are actually effective (flag the known Cloudflare "Manage
   AI bots" WAF rule risk noted in robots.txt's own comments).

8. **Local SEO** (the real "geo" dimension here) — NAP (Name/Address/Phone)
   consistency across all pages and schema, Google Business Profile
   alignment, whether the 5 location pages risk being seen as doorway pages
   (near-duplicate content targeting different cities), internal linking
   between them, `areaServed` accuracy in schema per page.

9. **Accessibility** — contrast, alt text, keyboard nav, ARIA/form labels
   (the contact form uses `novalidate` — check what replaces native
   validation).

10. **Security & Compliance** — HTTPS/HSTS, security headers, form spam
    protection, privacy policy adequacy for AU (Australian Privacy
    Principles) + any UK/US visitor data implications — don't assume GDPR
    cookie-banner requirements apply unless the site actually sets
    non-essential cookies.

11. **Cross-Browser & Error Pages** — 404 page quality, behavior on major
    browsers/devices.

12. **Analytics** — tracking installed and firing.

13. **Recommended Tools** — Lighthouse, PageSpeed Insights, Screaming Frog,
    axe/WAVE, Google Rich Results Test, and an AI-answer-engine check
    (e.g. asking ChatGPT/Perplexity "who builds AI automation software in
    Sydney/Australia" and checking whether daintytrading.com is cited).

14. **Prioritized Action Plan** — numbered, Critical first, quick wins vs.
    larger work, and call out what's already strong (llms.txt, AI-crawler
    robots.txt rules, existing schema).

Confirm you can access the site, then deliver the audit.
