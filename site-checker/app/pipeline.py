"""Orchestrates one public site check: probe -> homepage -> checks -> report."""
import logging
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from . import robots as robots_mod
from .checks_page import (check_measurement, check_page_security, check_page_seo, check_page_speed,
                          detect_platform)
from .checks_site import (check_ai_crawlers, check_llms_txt, check_robots, check_sitemap,
                          check_transport, looks_blocked)
from .context import Site
from .report import build_report
from .safefetch import FetchError, SafeFetcher

log = logging.getLogger("sitecheck")
OUR_ROBOTS_TOKEN = "TelaLoomSiteCheck"


_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _parse_html(html: str):
    """Parse untrusted HTML without ever raising: strip control chars, fall back to the stdlib parser."""
    html = _CONTROL_RE.sub("", html)
    try:
        return BeautifulSoup(html, "lxml")
    except Exception:
        log.warning("lxml rejected the page, falling back to html.parser")
        try:
            return BeautifulSoup(html, "html.parser")
        except Exception:
            return None


def _unreachable_reason(e: FetchError) -> str:
    if e.kind == "dns":
        return e.message  # "That domain doesn't resolve" is about the address, and the user can fix it
    if e.kind == "blocked":
        return "That address can't be checked from the public internet."
    # Timeouts and refused connections often mean the site blocks automated visits from data centres,
    # not that it's down - don't blame the site for something we can't tell.
    return ("We couldn't connect to the site from our server. It may be down, or it may block automated "
            "visits from data centres.")


def _safe(site: Site, name: str, fn) -> None:
    try:
        fn(site)
    except FetchError as e:
        site.skip(name, e.message)
    except Exception:  # a bug in one check must never sink the whole report
        log.exception("check %s failed for %s", name, site.host)
        site.skip(name, "This check hit an unexpected error")


def _probe(site: Site):
    """Fetch robots.txt over https, then http. Sets https_ok / https_error_*; returns (scheme, resp)."""
    last = None
    for scheme in ("https", "http"):
        try:
            resp = site.fetcher.get(f"{scheme}://{site.host}/robots.txt")
        except FetchError as e:
            last = e
            if scheme == "https":
                site.https_error_kind, site.https_error = e.kind, e.message
            if e.kind in ("dns", "blocked", "budget"):
                raise
            continue
        if scheme == "https":
            site.https_ok = True
        return scheme, resp
    raise last


def _run(site: Site) -> tuple:
    scheme, robots_resp = _probe(site)

    text = robots_resp.text if robots_resp.status == 200 else ""
    if text and "<html" not in text[:300].lower():
        site.robots = text
    if site.robots and robots_mod.specific_group_blocks_all(site.robots, OUR_ROBOTS_TOKEN):
        site.skip("Everything", "This site's robots.txt asks the TelaLoomSiteCheck crawler not to visit, so we didn't")
        return "opted_out", "This site's robots.txt asks our checker not to visit."

    try:
        home = site.fetcher.get(f"{scheme}://{site.host}/")
    except FetchError as e:
        if e.kind == "budget":
            raise
        reason = _unreachable_reason(e)
        site.skip("Everything except HTTPS and robots.txt", reason)
        _safe(site, "HTTPS", check_transport)
        return "unreachable", reason

    site.home = home
    parts = urlsplit(home.url)
    site.base = f"{parts.scheme}://{parts.netloc}"
    if home.body:
        site.soup = _parse_html(home.text)

    _safe(site, "HTTPS", check_transport)

    if looks_blocked(home):
        site.blocked = True
        site.skip("Page content, sitemap, AI-crawler and speed checks",
                  f"Your site's firewall turned our automated visit away (HTTP {home.status}). "
                  "That's common with bot protection, and it means we couldn't see the page. "
                  "It also suggests search engines and AI crawlers may struggle to see it.")
        _safe(site, "robots.txt", check_robots)
        return "blocked", f"Your site turned our automated visit away (HTTP {home.status})."

    if home.status >= 400:
        site.skip("Page content checks", f"The homepage returned HTTP {home.status}")
        _safe(site, "robots.txt", check_robots)
        return "partial", f"The homepage returned HTTP {home.status}."

    detect_platform(site)
    for name, fn in (
        ("robots.txt", check_robots),
        ("On-page SEO", check_page_seo),
        ("Page security", check_page_security),
        ("Speed", check_page_speed),
        ("Analytics", check_measurement),
        ("Sitemap", check_sitemap),
        ("llms.txt", check_llms_txt),
        ("AI-crawler access", check_ai_crawlers),
    ):
        _safe(site, name, fn)

    return ("partial", "Some checks ran out of time or budget.") if site.not_tested else ("complete", "")


def run_check(domain: str, *, fetcher=None) -> dict:
    """Run every check against `domain` (already normalised) and return the report dict."""
    started = time.monotonic()
    own = fetcher is None
    fetcher = fetcher or SafeFetcher()
    site = Site(host=domain, fetcher=fetcher)
    status, reason = "complete", ""
    try:
        status, reason = _run(site)
    except FetchError as e:
        if e.kind == "budget":
            status, reason = "partial", e.message
        else:
            status, reason = "unreachable", _unreachable_reason(e)
            site.skip("Everything", reason)
    finally:
        if own:
            fetcher.close()
    finished = time.monotonic()
    final_url = site.home.url if site.home else ""
    return build_report(site, domain, status, started=started, finished=finished,
                        checked_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        final_url=final_url, reason=reason)
