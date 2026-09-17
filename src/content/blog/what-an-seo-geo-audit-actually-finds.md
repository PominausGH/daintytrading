---
title: "What an SEO & GEO Audit Actually Finds"
description: "The recurring, fixable issues we find on almost every unaudited site: broken schema, missing llms.txt, robots.txt accidentally blocking AI crawlers, and thin metadata."
category: "SEO & GEO"
publishedDate: "2026-07-13"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.png"
---

<p>Most sites we audit were built to look right in a browser, not to be read correctly by a crawler — human or AI. That's not a criticism; it's just not what most teams are optimizing for when they ship. But it means the same handful of issues show up again and again, and every one of them is a fix, not a redesign. Here's what actually turns up.</p>

<h2>Missing or broken structured data</h2>
<p>Schema markup (JSON-LD, usually) is how a page tells Google — and increasingly, an AI answer engine — what it actually is: a product, an article, a business, a set of frequently asked questions. Sites without it aren't broken, they just leave the crawler to guess. We see three variants of this constantly: no schema at all, schema copy-pasted from a template that still references the wrong business name or URL, and schema that's syntactically valid JSON but semantically wrong (an <code>Organization</code> block with no <code>FAQPage</code> even though the page has an actual FAQ section a few hundred pixels below it).</p>

<h2>No <code>llms.txt</code></h2>
<p><code>llms.txt</code> is the newer of the two — a plain-text file at the site root that gives AI crawlers and agents a direct, structured summary of what the site is, what it costs, and where the key pages are, instead of making them infer it from rendered HTML. Almost nobody has one yet, which is exactly why it's worth having: it's a cheap, high-signal way to make sure an AI answer engine describes your product accurately instead of guessing from a scraped homepage.</p>

<h2>Robots.txt accidentally blocking the crawlers you want</h2>
<p>This is the one that surprises people most. A robots.txt file written a few years ago, before AI crawlers existed as a named category, will often use a broad <code>Disallow</code> rule that was meant to keep out scrapers or bad bots — and ends up blocking GPTBot, ClaudeBot, and PerplexityBot along with them. The site owner never opted into this; it's just what happens when a rule written for one era of the web gets left alone as the web changes around it. The fix is almost always a few lines, not a rewrite.</p>

<h2>Thin or duplicated meta tags</h2>
<p>Titles and meta descriptions that are missing, truncated, identical across pages, or — a specific one we've seen more than once — contain literal unrendered template markup because a client-side templating tag didn't get replaced before the page shipped to a crawler that doesn't run JavaScript. Small thing, visible everywhere it matters: search results, social previews, browser tabs.</p>

<h2>Why this is a code fix, not a report</h2>
<p>Most SEO audits end as a PDF with a priority list and leave the implementation to you. We do the opposite: the audit is the first half of the engagement, the fix is shipped directly into your codebase in the second half, and a third pass verifies it actually took — re-indexation, crawler access, the works. If you want to know specifically what's broken on your own site before committing to anything, <a href="/services/seo-geo-optimization.html">see how the engagement works</a>, or <a href="/contact.html">send us the URL</a> and we'll tell you what we find.</p>
