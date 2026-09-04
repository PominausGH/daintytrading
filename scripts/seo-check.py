#!/usr/bin/env python3
"""
Static SEO/indexability check for the public site.

Every finding here is something that silently costs Google (or an AI crawler)
a page: a page it can't discover, a page whose canonical points somewhere
else, structured data it throws away, or a page our analytics never sees so
we can't tell whether it earns traffic at all. All of them have shipped
before — the weekly Ghost Writer publisher writes post HTML by template, and
a stray double quote in generated copy is enough to void a whole JSON-LD
block without anything looking wrong in the browser.

Usage:
  python3 scripts/seo-check.py   # report, exit 1 on any finding

Deliberately not checked: sitemap <lastmod> freshness. This repo's history
has been rebuilt, and two sitewide commits (a cache-buster bump, the
analytics endpoint move) touched every page without changing a word, so a
git commit date is not a reliable stand-in for when a page's content last
changed. Dating pages from those commits would tell Google the whole site
changed at once — which is worse than a stale date, because it trains Google
to ignore our lastmod entirely. Update lastmod by hand when the content
genuinely changes.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://daintytrading.com"

# Directories that are never public pages: the API service, the token-gated
# admin app, and the generated OG image sources.
SKIP_DIRS = ("api/", "admin/", "og/", "node_modules/")

# The error page is served by nginx rather than linked or crawled, so it is
# neither a sitemap gap nor an orphan. Everything else that is deliberately
# out of the index says so with a noindex robots tag, which is detected below.
NOT_INDEXED = {"404.html"}

# Deliberately live but not submitted for crawling. Search Console had 66 URLs
# sitting at "Discovered - currently not indexed" — found via the sitemap,
# never fetched — so submitting the 300-500 word product blurbs was spending
# crawl budget on pages Google had already declined, at the expense of the
# ones that can rank. They stay linked from work.html for people. The three
# client case studies are real, substantial pages and stay submitted.
UNSUBMITTED_PREFIX = "projects/"
UNSUBMITTED_EXCEPTIONS = {
    "projects/edwards-kirby-lawyers.html",
    "projects/shuttersmith.html",
    "projects/new-shutter-business.html",
}


def submitted(rel):
    """Should this page be in sitemap.xml?"""
    return not rel.startswith(UNSUBMITTED_PREFIX) or rel in UNSUBMITTED_EXCEPTIONS


TRACKER = "/stats/sc.js"


def pages():
    out = []
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(SKIP_DIRS):
            continue
        out.append(rel)
    return out


def url_for(rel):
    return f"{SITE}/" if rel == "index.html" else f"{SITE}/{rel}"


def main():
    findings = []
    rels = pages()
    texts = {r: (ROOT / r).read_text(encoding="utf-8", errors="replace") for r in rels}

    # A page carrying noindex is out of the index on purpose (the client
    # status page, the review form): it is not a coverage gap and not an
    # orphan, so every check below reads this first.
    noindexed = {
        r for r, t in texts.items()
        if re.search(r'name="robots"[^>]*content="[^"]*noindex', t)
    }

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    sm_urls = re.findall(r"<loc>([^<]+)</loc>", sitemap)

    # 1. Sitemap points only at pages that exist, and covers every real page.
    for u in sm_urls:
        rel = "index.html" if u == f"{SITE}/" else u[len(SITE) + 1:]
        if not (ROOT / rel).exists():
            findings.append(f"sitemap lists a URL with no file: {u}")
    in_sitemap = {("index.html" if u == f"{SITE}/" else u[len(SITE) + 1:]) for u in sm_urls}
    for rel in rels:
        if (rel not in in_sitemap and rel not in NOT_INDEXED
                and rel not in noindexed and submitted(rel)):
            findings.append(f"page missing from sitemap.xml: {rel}")
    for rel in in_sitemap:
        if not submitted(rel):
            findings.append(f"deliberately unsubmitted page is back in sitemap.xml: {rel}")

    # 2. Nothing indexable is orphaned — a page no other page links to is one
    #    Google reaches through the sitemap alone, and ranks accordingly.
    linked = set()
    for r, t in texts.items():
        for href in re.findall(r'href="(/[^"#?]*)"', t):
            target = href.lstrip("/") or "index.html"
            if not target.endswith(".html"):
                target += ".html"
            if target != r:
                linked.add(target)
    for rel in rels:
        if rel in NOT_INDEXED or rel in noindexed or rel == "index.html":
            continue
        if rel not in linked:
            findings.append(f"orphan page — no internal links point to it: {rel}")

    for rel in rels:
        t = texts[rel]
        noindex = rel in noindexed

        # 3. Canonical points at this page's own live URL. A canonical aimed
        #    at a redirect or a sibling hands the ranking somewhere else.
        m = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', t)
        if not m:
            if not noindex:
                findings.append(f"no canonical: {rel}")
        elif m.group(1) != url_for(rel):
            findings.append(f"canonical is not self-referential: {rel} -> {m.group(1)}")

        # 4. JSON-LD actually parses. Invalid JSON is dropped whole, so the
        #    page loses its rich result without any visible symptom.
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', t, re.S):
            try:
                json.loads(block)
            except Exception as e:
                findings.append(f"invalid JSON-LD: {rel} ({e})")

        # 5. Meta descriptions survive HTML parsing. A raw double quote in
        #    generated copy truncates the attribute to empty.
        for name, pat in (("description", r'<meta name="description" content="([^"]*)"'),
                          ("og:description", r'<meta property="og:description" content="([^"]*)"')):
            mm = re.search(pat, t)
            if mm is not None and not mm.group(1).strip() and not noindex:
                findings.append(f"empty {name} (likely an unescaped quote): {rel}")

        # 6. Analytics present, and via the same-origin proxy — the third-party
        #    hostname is stripped by ad blockers, which is what made traffic
        #    look like it wasn't arriving in the first place.
        if not noindex:
            if TRACKER not in t:
                if "analytics.daintytrading.com" in t:
                    findings.append(f"analytics loaded from the ad-blocked domain: {rel}")
                else:
                    findings.append(f"no analytics tracker: {rel}")

    if findings:
        print(f"{len(findings)} finding(s):")
        for f in findings:
            print(f"  - {f}")
        return 1
    print("no findings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
