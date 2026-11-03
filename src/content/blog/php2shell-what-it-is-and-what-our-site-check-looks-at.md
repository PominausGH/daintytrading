---
title: "PHP2Shell: Is Your Site Exposed, and What Our Free Site Check Looks At"
description: "Two critical PHP flaws found with AI were disclosed in October 2026. Here's how to tell if your site runs an affected version, and exactly what our free Site Check does and doesn't look at."
category: "Infrastructure"
publishedDate: "2026-11-03"
readTime: "4 min"
ogImage: "https://telaloom.com/og-card.png"
---

<p>If your website runs on PHP — which includes every WordPress site — and your host hasn't updated PHP since 21 October 2026, it may be exposed to two critical flaws called PHP2Shell. The fixed versions are PHP 8.5.12, 8.4.27, 8.3.36 and 8.2.35. The quickest check is to ask your host which PHP version your site runs.</p>

<p>The two flaws (CVE-2026-109618 and CVE-2026-109619) sit in PHP's core engine and score 9.2 out of 10. <a href="https://www.wiz.io/blog/php2shell-php-rce" rel="noopener">Wiz's write-up</a> says they let an unauthenticated attacker run code on an unpatched web server, and that AI models played a key part in finding them. We also added a narrow check to our free Site Check because of it, so this post covers both the flaw and what that check does.</p>

<h2>How to tell if you're affected</h2>

<p>Three questions, in order:</p>

<p><strong>1. Does your site run PHP?</strong> WordPress, WooCommerce, Joomla, Drupal and most older custom sites do. A site built on a hosted builder (Shopify, Squarespace, Wix) or a static site generally doesn't run your PHP — the platform does, and patching it is their job. A site built with Astro or Next.js isn't PHP at all.</p>

<p><strong>2. Which version?</strong> Your host's control panel will show it, usually under a heading like "PHP version" or "PHP selector". If it's below the fixed version for its branch (8.5.12, 8.4.27, 8.3.36 or 8.2.35), ask your host to update. Branches older than 8.2 weren't part of this patch release at all, so a site on 8.1 or earlier needs moving to a supported version.</p>

<p><strong>3. Has it actually been patched?</strong> Some hosts patch the server without changing the visible version number, and some hide the version entirely. If you can't tell, ask them directly. "We've applied the PHP2Shell fixes" is a straightforward thing for a host to confirm.</p>

<p>One caveat, once: reports differ on whether attackers are already exploiting these flaws at scale. We'd treat it as urgent anyway — it's a free fix for a critical hole, and patching is cheap compared with cleaning up after a break-in.</p>

<h2>What our free Site Check looks at</h2>

<p>The <a href="/site-check.html">Site Check</a> only reads what any visitor or search engine can already see: your homepage, robots.txt, sitemap, llms.txt and a handful of pages. About 15 requests, once per site per day. It doesn't log in, submit forms, scan ports or probe for vulnerabilities. Visits identify themselves as <code>TelaLoomSiteCheck/1.0</code>, and if you'd rather we didn't visit, a two-line addition to your robots.txt stops us.</p>

<p>What we added after PHP2Shell is one narrow thing: if your site announces its PHP version in its public response headers, the Site Check compares it against the fixed versions above. If it looks affected, the report says your site appears to run software with a known critical flaw, and suggests asking your host to confirm PHP is fully updated. It doesn't print your exact version.</p>

<p>That's a hint, not a verdict, and the limits are real:</p>

<p>Many hosts hide the version, so no flag doesn't mean you're patched. Others backport fixes without changing the number, so a flag can be a false alarm. That's why the report says "appears to" and not "is vulnerable". Treat it as a prompt to ask your host, not as proof either way.</p>

<h2>What we deliberately don't check</h2>

<p>A fuller security check would go looking for signs a site has already been compromised — leftover shell files, exposed upload folders, debug pages. We don't do that in the free tool, because anyone can run it against any domain, and we can't verify you own the site you typed in. Poking around someone else's site without their say-so isn't something we'll build into a public form.</p>

<p>That kind of check is something we do when you've asked us to, on your site, under an agreement. If you think your site may already have been touched, tell us and we'll look properly rather than guess from the outside.</p>

<h2>What to do this week</h2>

<p>Ask your host what PHP version your site runs and whether the PHP2Shell fixes are applied. If you'd like a quick outside read first, <a href="/site-check.html">run the free Site Check</a> — and if it flags something or you can't get a straight answer from your host, <a href="/contact.html">get in touch</a> and we'll tell you whether it needs fixing or whether you can leave it alone.</p>
