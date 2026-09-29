"""Checks that only need the homepage response (headers + HTML): on-page SEO/GEO basics,
in-page security signals, coarse speed heuristics, analytics, platform."""
import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit

from .context import Site
from .findings import clean

_BUSINESS_TYPES = {
    "organization", "localbusiness", "corporation", "onlinestore", "onlinebusiness", "store", "person",
    "professionalservice", "legalservice", "restaurant", "medicalbusiness", "dentist", "physician",
    "attorney", "plumber", "electrician", "homeandconstructionbusiness", "automotivebusiness",
    "foodestablishment", "healthandbeautybusiness", "realestateagent", "financialservice",
    "accountingservice", "lodgingbusiness", "sportsactivitylocation",
}

_ANALYTICS = [
    ("Google Analytics / Tag Manager", r"googletagmanager\.com|google-analytics\.com|/gtag/js|gtag\("),
    ("Plausible", r"plausible\.io/js"),
    ("Umami", r"data-website-id="),
    ("Matomo", r"matomo|piwik"),
    ("Fathom", r"usefathom\.com"),
    ("Cloudflare Web Analytics", r"cloudflareinsights\.com"),
    ("Microsoft Clarity", r"clarity\.ms"),
    ("Hotjar", r"hotjar\.com"),
    ("Facebook Pixel", r"connect\.facebook\.net|fbq\("),
    ("Simple Analytics", r"simpleanalytics"),
    ("Shopify Analytics", r"shopifyanalytics|trekkie|monorail-edge\.shopifysvc|web-pixels-manager"),
]

# Hosted site builders include their own analytics dashboard; whether it's switched on isn't
# something we can see from outside, so we say that instead of raising a false alarm.
_BUILDERS_WITH_BUILTIN_ANALYTICS = {"Wix", "Squarespace", "Shopify", "Weebly", "GoDaddy Website Builder"}

_PLATFORMS = [
    ("Wix", r"wixstatic\.com|x-wix-request-id|wix\.com"),
    ("Squarespace", r"squarespace"),
    ("Shopify", r"cdn\.shopify\.com|x-shopid"),
    ("Weebly", r"weebly\.com|editmysite\.com"),
    ("GoDaddy Website Builder", r"img1\.wsimg\.com|wsimg\.com/"),
    ("Webflow", r"webflow"),
    ("WordPress", r"wp-content|wp-includes|content=\"wordpress"),
    ("Drupal", r"drupal"),
    ("Joomla", r"joomla"),
]


def _headers_blob(site: Site) -> str:
    h = site.home.headers if site.home else {}
    return " ".join(f"{k}: {v}" for k, v in h.items()).lower()


def detect_platform(site: Site) -> None:
    html = (site.home.text if site.home else "").lower()
    blob = html + " " + _headers_blob(site)
    for name, pattern in _PLATFORMS:
        if re.search(pattern, blob):
            site.platform = name
            return


def _jsonld_types(node, out: set):
    if isinstance(node, list):
        for n in node:
            _jsonld_types(n, out)
    elif isinstance(node, dict):
        t = node.get("@type")
        for x in (t if isinstance(t, list) else [t]):
            if isinstance(x, str):
                out.add(x)
        for v in node.values():
            if isinstance(v, (dict, list)):
                _jsonld_types(v, out)


def check_page_seo(site: Site) -> None:
    soup, home = site.soup, site.home
    if soup is None or home is None:
        return

    # Title / description
    title_el = soup.find("title")
    title = (title_el.get_text() if title_el else "").strip()
    if not title:
        site.add("missing_title", "findability", "high", "Your homepage has no title",
                 "The title is what shows as the blue link in Google and as the tab name. Without one, "
                 "search engines guess, and usually guess badly.", "No <title> found")
    elif len(title) > 80 or len(title) < 10:
        site.add("title_length", "findability", "low", "Your homepage title is the wrong length",
                 "Google shows roughly the first 60 characters. Much longer gets cut off; much shorter wastes "
                 "the space.", f"{len(title)} characters: {title}")
    desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
    if not desc or not (desc.get("content") or "").strip():
        site.add("missing_description", "findability", "medium", "Your homepage has no meta description",
                 "This is the summary Google shows under your link. Without it, Google picks random text from "
                 "the page, which usually reads worse and gets fewer clicks.", "No meta description found")

    # Indexability
    robots_meta = soup.find("meta", attrs={"name": re.compile(r"^robots$", re.I)})
    xrt = home.headers.get("x-robots-tag", "")
    if (robots_meta and "noindex" in (robots_meta.get("content") or "").lower()) or "noindex" in xrt.lower():
        site.add("noindex_home", "findability", "high", "Your homepage tells search engines not to list it",
                 "A 'noindex' instruction keeps the page out of Google entirely. It's common on sites that were "
                 "built on a staging copy and never switched over.",
                 xrt if "noindex" in xrt.lower() else (robots_meta.get("content") or ""))

    # Canonical
    canon = soup.find("link", rel=lambda v: v and "canonical" in (v if isinstance(v, list) else [v]))
    href = (canon.get("href") if canon else "") or ""
    if not href.strip():
        site.add("no_canonical", "findability", "low", "No canonical tag",
                 "A canonical tag tells Google which address is the 'real' one when the same page is reachable "
                 "several ways (www or not, with or without a trailing slash).", "No <link rel=canonical> found")
    else:
        absolute = urljoin(home.url, href.strip())
        chost = (urlsplit(absolute).hostname or "").lower().removeprefix("www.")
        shost = site.host.removeprefix("www.")
        if chost and chost != shost:
            site.add("canonical_mismatch", "findability", "medium",
                     "Your canonical tag points at a different website",
                     "That tells Google the 'real' version of your homepage lives somewhere else, which can "
                     "remove your site from results.", absolute)

    # Basics
    html_tag = soup.find("html")
    if not html_tag or not (html_tag.get("lang") or "").strip():
        site.add("no_lang", "findability", "low", "The page doesn't declare its language",
                 "A lang attribute helps search engines and screen readers handle the page correctly.",
                 "No lang attribute on <html>")
    if not soup.find("h1"):
        site.add("no_h1", "findability", "low", "The homepage has no main heading",
                 "An H1 heading tells search engines and AI assistants what the page is about.", "No <h1> found")
    if not soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)}):
        site.add("no_viewport", "findability", "medium", "The site isn't set up for mobile screens",
                 "Without a viewport tag, phones show a shrunken desktop page. Google ranks on the mobile "
                 "version, so this hurts rankings as well as visitors.", "No viewport meta tag found")
    og_missing = [p for p in ("og:title", "og:description", "og:image")
                  if not soup.find("meta", attrs={"property": p})]
    if len(og_missing) == 3:
        site.add("no_og", "findability", "low", "No link-preview tags",
                 "When someone shares your site on Facebook, LinkedIn or iMessage it shows as a bare link "
                 "instead of a title and image.", "No og:title, og:description or og:image found")

    imgs = soup.find_all("img")
    if len(imgs) >= 3:
        no_alt = [i for i in imgs if i.get("alt") is None]
        if len(no_alt) / len(imgs) >= 0.5:
            site.add("images_no_alt", "findability", "low", "Most images have no alt text",
                     "Alt text describes an image to search engines, AI assistants and visitors using screen "
                     "readers.", f"{len(no_alt)} of {len(imgs)} images have no alt attribute")

    # Structured data
    scripts = soup.find_all("script", attrs={"type": re.compile(r"^application/ld\+json$", re.I)})
    types, invalid = set(), 0
    for s in scripts:
        try:
            _jsonld_types(json.loads(s.string or s.get_text() or ""), types)
        except (ValueError, TypeError):
            invalid += 1
    if not scripts:
        site.add("no_structured_data", "findability", "medium", "No structured data (schema markup)",
                 "Structured data is a machine-readable description of your business: name, services, address, "
                 "opening hours. Google uses it for rich results, and AI assistants use it to answer 'who does "
                 "X near me' without guessing.", "No application/ld+json blocks found")
    elif invalid and not types:
        site.add("structured_data_invalid", "findability", "medium", "Your structured data is broken",
                 "The schema markup on the page isn't valid, so search engines and AI assistants ignore it.",
                 f"{invalid} block(s) that don't parse as JSON")
    else:
        lower = {t.lower() for t in types}
        if lower & _BUSINESS_TYPES or any(t.endswith("business") for t in lower):
            shown = ", ".join(clean(t, 40) for t in sorted(types)[:4])   # @type values are site-controlled
            site.ok("Structured data found describing the business (" + shown + ")")
        else:
            site.add("no_business_schema", "findability", "low", "Structured data doesn't describe your business",
                     "There's some schema markup, but nothing that says who you are, what you do or where.",
                     "Types found: " + (", ".join(sorted(types)[:5]) or "none"))

    if not site.has("missing_title") and not site.has("missing_description"):
        site.ok("Homepage has a title and meta description")


def check_page_security(site: Site) -> None:
    home, soup = site.home, site.soup
    if home is None or soup is None:
        return
    h = {k.lower(): v for k, v in home.headers.items()}
    is_https = home.url.startswith("https://")

    missing = []
    if is_https and "strict-transport-security" not in h:
        missing.append("HSTS")
    if "content-security-policy" not in h:
        missing.append("Content-Security-Policy")
    if "x-content-type-options" not in h:
        missing.append("X-Content-Type-Options")
    if "x-frame-options" not in h and "frame-ancestors" not in h.get("content-security-policy", ""):
        missing.append("clickjacking protection")
    if "referrer-policy" not in h:
        missing.append("Referrer-Policy")
    if missing:
        # Always low: nearly every small-business site lacks most of these, so it can't be what
        # tips a report into "big job" - it's best practice, not a hole.
        site.add("security_headers", "security", "low",
                 "Some standard security headers are missing",
                 "These are short instructions your web server sends that switch on built-in browser protections "
                 "against common attacks. They're quick to add and most security scanners look for them.",
                 "Missing: " + ", ".join(missing))
    else:
        site.ok("Standard security headers are in place")

    if is_https:
        active, passive = [], []
        for tag, attr in (("script", "src"), ("iframe", "src"), ("link", "href")):
            for el in soup.find_all(tag):
                v = (el.get(attr) or "").strip()
                if v.startswith("http://") and (tag != "link" or "stylesheet" in (el.get("rel") or [])):
                    active.append(v)
        for el in soup.find_all(["img", "source", "video", "audio"]):
            v = (el.get("src") or "").strip()
            if v.startswith("http://"):
                passive.append(v)
        if active or passive:
            site.add("mixed_content", "security", "medium" if active else "low",
                     "Some page content loads over insecure http://",
                     "A secure page that pulls in insecure files triggers browser warnings or blocked content, "
                     "and undermines the padlock.",
                     f"{len(active)} script/style/frame and {len(passive)} image/media resource(s); e.g. "
                     + (active or passive)[0])

    # End-of-life software (coarse on purpose: no exact versions or plugin names in the public report)
    eol = []
    m = re.search(r"php/(\d+)\.(\d+)", h.get("x-powered-by", "").lower())
    if m and (int(m.group(1)), int(m.group(2))) < (8, 1):
        eol.append("PHP older than 8.1")
    if re.search(r"apache/2\.2\b", h.get("server", "").lower()):
        eol.append("Apache 2.2")
    im = re.search(r"microsoft-iis/(\d+)", h.get("server", "").lower())
    if im and int(im.group(1)) <= 7:
        eol.append("Microsoft IIS 7 or older")
    gen = soup.find("meta", attrs={"name": re.compile(r"^generator$", re.I)})
    gtxt = (gen.get("content") if gen else "") or ""
    wm = re.search(r"wordpress\s+(\d+)\.(\d+)", gtxt.lower())
    if wm and (int(wm.group(1)), int(wm.group(2))) < (6, 0):
        eol.append("WordPress older than 6.0")
    if re.search(r"drupal\s+7\b", gtxt.lower()) or "drupal 7" in h.get("x-generator", "").lower():
        eol.append("Drupal 7")
    if eol:
        site.add("eol_software", "security", "high", "The site appears to run software that's no longer supported",
                 "Unsupported software stops receiving security fixes, so known holes stay open. Upgrading an "
                 "old setup in place is often more work than rebuilding it properly.",
                 "; ".join(eol))

    # Stale copyright year (a trust signal, nothing more)
    now_year = datetime.now(timezone.utc).year
    text = soup.get_text(" ")
    years = [int(y) for y in re.findall(r"(?:©|&copy;|\(c\)|copyright)\s*(?:\d{4}\s*[-–—]\s*)?(\d{4})", text, re.I)]
    years = [y for y in years if 1995 <= y <= now_year + 1]
    if years and max(years) < now_year - 1:
        site.add("stale_copyright", "security", "low", "The footer copyright year is out of date",
                 "It's a small thing, but a footer stuck on an old year makes visitors wonder if the business "
                 "is still active.", f"Footer shows {max(years)}")


def check_page_speed(site: Site) -> None:
    home = site.home
    if home is None:
        return
    # Our test server is in Europe, so raw time-to-first-byte includes a lot of network distance for
    # sites hosted in Australia or the US. Subtract the handshake round-trips (TCP + TLS + request,
    # ~3 round trips over https, 2 over http) so we judge the *server*, not geography.
    trips = 3 if home.url.startswith("https://") else 2
    server_time = max(0.0, home.ttfb - trips * home.rtt)
    evidence = (f"{server_time:.1f}s of server time (total {home.ttfb:.1f}s, of which about "
                f"{trips * home.rtt:.1f}s is network distance from our test server)")
    if server_time > 3.0:
        site.add("slow_response", "speed", "medium", "The server is slow to respond",
                 "After allowing for the distance from our test server, the site still took over three seconds "
                 "to start sending the page. Visitors and Google both notice; slow hosting or heavy back-end "
                 "work is the usual cause.", evidence)
    elif server_time > 1.5:
        site.add("slow_response", "speed", "low", "The server is a little slow to respond",
                 "After allowing for the distance from our test server, the site took over a second and a half "
                 "to start sending the page. Not terrible, but faster hosting or caching would help.", evidence)
    size = len(home.body)
    enc = home.headers.get("content-encoding", "").lower()
    if size > 10000 and not home.truncated and enc not in ("gzip", "br", "deflate", "zstd"):
        site.add("no_compression", "speed", "low", "Pages aren't compressed",
                 "Compression makes pages download several times faster. It's a one-line server setting.",
                 f"{size // 1000} KB of HTML sent uncompressed")
    if home.truncated or size > 600_000:
        heavy = home.truncated or size > 1_000_000
        shown = 1_500_000 if home.truncated else size
        site.add("heavy_html", "speed", "medium" if heavy else "low",
                 "The homepage is very heavy" if heavy else "The homepage is on the heavy side",
                 "The page's HTML alone is large, which usually means bloated page-builder output or lots of "
                 "inline junk. It slows every visit, especially on phones.",
                 f"{'over ' if home.truncated else ''}{shown // 1000} KB of HTML"
                 + (f" ({home.transfer_bytes // 1000} KB after compression)" if home.transfer_bytes else ""))
    soup = site.soup
    if soup is not None and soup.head is not None:
        blocking = [s for s in soup.head.find_all("script", src=True)
                    if not s.has_attr("async") and not s.has_attr("defer") and s.get("type") != "module"]
        if len(blocking) >= 3:
            site.add("render_blocking_scripts", "speed", "low", "Scripts are holding up the page",
                     "Several scripts in the page head load before anything is shown. Marking them async or "
                     "defer lets the page appear sooner.", f"{len(blocking)} blocking scripts in <head>")


def check_measurement(site: Site) -> None:
    html = (site.home.text if site.home else "").lower()
    found = [name for name, pattern in _ANALYTICS if re.search(pattern, html)]
    if found:
        site.ok("Analytics detected (" + ", ".join(found[:3]) + ")")
    elif site.platform in _BUILDERS_WITH_BUILTIN_ANALYTICS:
        site.note(f"Your site is on {site.platform}, which has its own built-in analytics. We can't see from "
                  "outside whether it's switched on, so we didn't check it.")
    else:
        site.add("no_analytics", "measurement", "medium", "No analytics on the site",
                 "Without analytics you can't see how many people visit, where they come from or what they do, "
                 "so you can't tell whether any change is working. (We can only see what's in the page source; "
                 "analytics loaded through other tools may not show up.)",
                 "No Google Analytics, Plausible, Umami, Matomo, Fathom, Clarity or similar found")
