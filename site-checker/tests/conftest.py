import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.safefetch import FetchError, Response  # noqa: E402


def resp(url, status=200, body="", headers=None, ttfb=0.1, truncated=False, redirects=None, rtt=0.0,
         transfer_bytes=0):
    h = {"content-type": "text/html; charset=utf-8", "content-encoding": "gzip"}
    h.update({k.lower(): v for k, v in (headers or {}).items()})
    data = body.encode() if isinstance(body, str) else body
    return Response(url=url, status=status, headers=h, body=data, ttfb=ttfb, truncated=truncated,
                    redirects=redirects or [], ip="203.0.113.10", rtt=rtt, transfer_bytes=transfer_bytes)


class FakeFetcher:
    """Stands in for SafeFetcher. routes: url -> Response | FetchError | callable(headers)->Response."""

    def __init__(self, routes):
        self.routes = dict(routes)
        self.requests_made = 0
        self.calls = []

    def get(self, url, *, headers=None, follow=True, max_bytes=0, read_body=True):
        self.requests_made += 1
        self.calls.append((url, dict(headers or {})))
        r = self.routes.get(url)
        if r is None:
            return resp(url, status=404, body="not found")
        if isinstance(r, FetchError):
            raise r
        if callable(r):
            return r(headers or {})
        return r

    def close(self):
        pass


from datetime import datetime, timezone  # noqa: E402

_YEAR = datetime.now(timezone.utc).year

GOOD_HTML = """<!doctype html><html lang="en"><head>
<title>Acme Plumbing - Emergency plumber in Brisbane</title>
<meta name="description" content="Licensed Brisbane plumbers, 24/7 emergency callouts.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://acme.example/">
<meta property="og:title" content="Acme"><meta property="og:image" content="https://acme.example/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Acme Plumbing"}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
</head><body><h1>Acme Plumbing</h1><img src="/a.jpg" alt="van"><p>&copy; __YEAR__ Acme</p></body></html>""".replace("__YEAR__", str(_YEAR))

SECURE_HEADERS = {
    "strict-transport-security": "max-age=31536000",
    "content-security-policy": "default-src 'self'",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
}

SITEMAP_XML = """<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://acme.example/</loc></url><url><loc>https://acme.example/about</loc></url></urlset>"""


def healthy_routes(host="acme.example"):
    base = f"https://{host}"
    return {
        f"{base}/robots.txt": resp(f"{base}/robots.txt", body="User-agent: *\nAllow: /\nSitemap: https://acme.example/sitemap.xml",
                                   headers={"content-type": "text/plain"}),
        f"{base}/": resp(f"{base}/", body=GOOD_HTML, headers=SECURE_HEADERS),
        f"http://{host}/": resp(f"http://{host}/", status=301, headers={"location": f"{base}/"}),
        f"{base}/sitemap.xml": resp(f"{base}/sitemap.xml", body=SITEMAP_XML, headers={"content-type": "application/xml"}),
        f"{base}/about": resp(f"{base}/about", body="ok"),
        f"{base}/llms.txt": resp(f"{base}/llms.txt", body="# Acme Plumbing\nBrisbane plumbers.", headers={"content-type": "text/plain"}),
    }
