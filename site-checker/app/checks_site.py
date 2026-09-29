"""Checks that fetch extra well-known files or re-visit the homepage: transport (HTTPS),
robots.txt / sitemap / llms.txt, and the AI-crawler access test."""
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlsplit

from lxml import etree

from . import robots as robots_mod
from .context import Site
from .safefetch import FetchError, USER_AGENT

# Product tokens of the AI crawlers we test, with a realistic UA string. Our own identifier is
# appended so the site owner's logs show exactly what made the request.
_OURS = "TelaLoomSiteCheck/1.0 (test of AI-crawler access; +https://telaloom.com/site-check.html#about)"
AI_BOTS = [
    ("GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot) " + _OURS),
    ("ClaudeBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com) " + _OURS),
    ("PerplexityBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot) " + _OURS),
    ("CCBot", "CCBot/2.0 (https://commoncrawl.org/faq/) " + _OURS),
]
# 429 is deliberately absent: it means "slow down" (rate limiting), not "you're not allowed".
_BLOCK_STATUSES = {401, 403, 406, 451}

_CHALLENGE_MARKERS = (
    "just a moment", "cf-chl", "attention required", "captcha", "access denied",
    "enable javascript and cookies", "checking your browser", "ddos protection by",
)


def looks_blocked(resp) -> bool:
    if resp is None:
        return False
    if resp.headers.get("cf-mitigated"):
        return True
    if resp.status in (401, 403, 429, 503):
        return True
    if resp.status == 200 and len(resp.body) < 20000:
        low = resp.text.lower()
        if any(m in low for m in _CHALLENGE_MARKERS) and "<title" in low and len(low) < 20000:
            return True
    return False


def _origin(site: Site) -> str:
    return site.base or f"https://{site.host}"


def _fetch_parallel(site: Site, items: list, **kw) -> list:
    """Fetch several (url, headers) pairs at once (max 4 at a time). Failed fetches come back as
    None; running out of budget still raises so the caller stops."""
    def one(item):
        url, headers = item
        try:
            return site.fetcher.get(url, headers=headers or None, **kw)
        except FetchError as e:
            return e

    if not items:
        return []
    with ThreadPoolExecutor(max_workers=min(4, len(items))) as ex:
        out = list(ex.map(one, items))
    for o in out:
        if isinstance(o, FetchError) and o.kind == "budget":
            raise o
    return [None if isinstance(o, FetchError) else o for o in out]


def _fetch_quiet(site: Site, url: str, **kw):
    """GET that turns FetchErrors into None (caller decides whether that matters)."""
    try:
        return site.fetcher.get(url, **kw)
    except FetchError as e:
        if e.kind == "budget":
            raise
        return None


# --- transport -------------------------------------------------------------------------

def check_transport(site: Site) -> None:
    home = site.home
    final_https = bool(home and home.url.startswith("https://"))
    if site.https_ok:
        site.ok("Served over HTTPS with a valid certificate")
        http_resp = _fetch_quiet(site, f"http://{site.host}/", follow=False, read_body=False)
        if http_resp is not None:
            loc = http_resp.headers.get("location", "")
            if http_resp.status in (301, 302, 303, 307, 308) and loc.lower().startswith("https://"):
                site.ok("Visitors on http:// are sent to the secure version")
            elif http_resp.status == 200:
                site.add("no_https_redirect", "security", "medium",
                         "Visitors on http:// aren't sent to the secure version",
                         "Anyone who types your address without https:// or follows an old link lands on the "
                         "insecure copy of your site. A redirect to the https:// version fixes it.",
                         f"http://{site.host}/ answered 200 without redirecting")
    elif site.https_error_kind == "tls":
        site.add("tls_error", "security", "high", "Your site's security certificate has a problem",
                 "Browsers show visitors a full-page warning before they reach the site, and many leave. "
                 "Search engines and AI assistants treat it as untrustworthy too.",
                 site.https_error)
    else:
        site.add("no_https", "security", "high", "Your site isn't available over HTTPS",
                 "Browsers label it 'Not secure', Google favours secure sites, and anything visitors type into "
                 "a form travels unprotected. It's usually a hosting setting, but very old setups sometimes "
                 "can't support it.",
                 site.https_error or f"https://{site.host}/ couldn't be reached")
    if not final_https and site.https_ok and home is not None:
        site.add("https_downgrade", "security", "medium", "Your homepage ends up on http://",
                 "The secure version of the site redirects visitors back to the insecure one.",
                 home.url)


# --- robots / sitemap / llms.txt -------------------------------------------------------

def check_robots(site: Site) -> None:
    if site.robots is None:
        return
    if robots_mod.blocks_all_for(site.robots, "Googlebot") in ("wildcard", "specific"):
        site.add("robots_blocks_all", "findability", "high",
                 "robots.txt tells search engines to stay away from the whole site",
                 "A 'Disallow: /' rule stops Google and others from crawling any page. It's often left over from "
                 "a staging site. Unless it's deliberate, the site can't rank.",
                 "robots.txt contains: Disallow: /")


def _parse_sitemap(body: bytes):
    """Return (kind, locs) or None if it doesn't parse as a sitemap."""
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False,
                             dtd_validation=False, huge_tree=False, recover=False)
    try:
        root = etree.fromstring(body, parser=parser)
    except etree.XMLSyntaxError:
        return None
    name = etree.QName(root).localname.lower()
    if name not in ("urlset", "sitemapindex"):
        return None
    # Only the page/sitemap <loc> directly inside <url>/<sitemap>. Image, video and news extensions
    # also use a <loc> element (e.g. image:loc); those are assets, not pages.
    locs = []
    for entry in root:
        if not isinstance(entry.tag, str) or etree.QName(entry).localname not in ("url", "sitemap"):
            continue
        for child in entry:
            if not isinstance(child.tag, str):
                continue
            q = etree.QName(child)
            if q.localname == "loc" and (q.namespace is None or q.namespace.endswith("sitemaps.org/schemas/sitemap/0.9")):
                if child.text:
                    locs.append(child.text.strip())
    return ("index" if name == "sitemapindex" else "urlset"), locs


def _same_site(site: Site, url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    bare = site.host[4:] if site.host.startswith("www.") else site.host
    return host == site.host or host == bare or host == "www." + bare


def check_sitemap(site: Site) -> None:
    origin = _origin(site)
    candidates = []
    for declared in robots_mod.sitemaps(site.robots or "")[:2]:
        candidates.append(urljoin(origin + "/", declared))
    for path in ("/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"):
        u = origin + path
        if u not in candidates:
            candidates.append(u)

    found = None
    for url in candidates[:4]:
        resp = _fetch_quiet(site, url)
        if resp is None or resp.status != 200:
            continue
        head = resp.text.lstrip()[:200].lower()
        if "<html" in head or "<!doctype html" in head:
            continue  # a soft-404 page, not a sitemap
        found = (url, resp)
        break

    if not found:
        site.add("no_sitemap", "findability", "low", "No sitemap found",
                 "A sitemap lists your pages for search engines and AI assistants. Small sites usually get found "
                 "anyway, but it helps new pages get picked up faster.",
                 "Checked robots.txt, /sitemap.xml, /sitemap_index.xml, /wp-sitemap.xml")
        return

    url, resp = found
    parsed = _parse_sitemap(resp.body)
    if parsed is None:
        if resp.truncated and resp.body.lstrip()[:5] in (b"<?xml", b"<urls", b"<site"):
            site.ok("Sitemap found (a large one)")
            return
        site.add("sitemap_broken", "findability", "medium", "Your sitemap can't be read",
                 "The sitemap file exists but isn't valid XML, so search engines will ignore it.", url)
        return

    kind, locs = parsed
    if kind == "index":
        child = next((l for l in locs if _same_site(site, l)), None)
        if child:
            cresp = _fetch_quiet(site, child)
            cparsed = _parse_sitemap(cresp.body) if cresp is not None and cresp.status == 200 else None
            locs = cparsed[1] if cparsed else []
        else:
            locs = []
    page_urls = [l for l in locs if _same_site(site, l)]
    if not page_urls:
        if kind == "urlset":
            site.add("sitemap_broken", "findability", "medium", "Your sitemap is empty",
                     "The sitemap file lists no pages, so it isn't helping search engines find anything.", url)
        else:
            site.ok("Sitemap index found")
        return

    sample = []
    for idx in (0, len(page_urls) // 2, len(page_urls) - 1):
        if page_urls[idx] not in sample:
            sample.append(page_urls[idx])
    sample = sample[:3]
    results = _fetch_parallel(site, [(u, {}) for u in sample], read_body=False, follow=True)
    bad = []
    for u, r in zip(sample, results):
        # 403/429 mean "we were turned away", not "the page is broken" - don't blame the sitemap.
        if r is not None and r.status in (401, 403, 429):
            continue
        if r is None or r.status == 404 or r.status == 410 or r.status >= 500:
            bad.append(f"{u} -> {r.status if r else 'no response'}")
    if bad:
        # One odd page in three could be a blip; two or more is a real problem.
        site.add("sitemap_broken", "findability", "medium" if len(bad) >= 2 else "low",
                 "Your sitemap lists pages that don't load",
                 "Some pages listed in the sitemap return errors. Search engines lose trust in sitemaps that "
                 "point at broken pages.", "; ".join(bad))
    else:
        site.ok(f"Sitemap found ({len(page_urls)} page{'s' if len(page_urls) != 1 else ''} listed)")


def check_llms_txt(site: Site) -> None:
    resp = _fetch_quiet(site, _origin(site) + "/llms.txt")
    text = resp.text.strip() if resp is not None and resp.status == 200 else ""
    if text and "<html" not in text[:300].lower():
        site.ok("llms.txt found (a guide for AI assistants)")
    else:
        site.add("no_llms_txt", "findability", "low", "No llms.txt file",
                 "llms.txt is a plain-text summary of your business written for AI assistants like ChatGPT and "
                 "Claude. It's a small, cheap way to make sure they describe you correctly.",
                 f"{_origin(site)}/llms.txt returned {resp.status if resp is not None else 'no response'}")


def check_ai_crawlers(site: Site) -> None:
    if site.home is None or site.home.status >= 400:
        site.skip("AI-crawler access", "The homepage didn't load normally, so there was nothing to compare against")
        return
    origin = _origin(site)
    blocked_server, blocked_robots = [], []
    results = _fetch_parallel(site, [(origin + "/", {"User-Agent": ua}) for _token, ua in AI_BOTS],
                              read_body=False)
    for (token, _ua), resp in zip(AI_BOTS, results):
        if resp is not None and (resp.status in _BLOCK_STATUSES or resp.status >= 500
                                 or resp.headers.get("cf-mitigated")):
            blocked_server.append(f"{token}: HTTP {resp.status}")
        if site.robots and robots_mod.blocks_all_for(site.robots, token):
            blocked_robots.append(token)
    if blocked_server or blocked_robots:
        parts = []
        if blocked_server:
            parts.append("turned away by the server (" + ", ".join(blocked_server) + f"; a normal visit got HTTP {site.home.status})")
        if blocked_robots:
            parts.append("told to stay out by robots.txt (" + ", ".join(blocked_robots) + ")")
        site.add("ai_crawlers_blocked", "findability", "medium",
                 "AI assistants may not be able to read your site",
                 "When AI crawlers are blocked, tools like ChatGPT, Claude and Perplexity can't learn what you do, "
                 "so they can't recommend you. This is often a hosting or firewall default rather than a choice "
                 "(Cloudflare and some hosts block AI bots out of the box). If you blocked them on purpose, that's fine.",
                 "; ".join(parts))
    else:
        site.ok("AI assistants' crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot) can reach the site")
