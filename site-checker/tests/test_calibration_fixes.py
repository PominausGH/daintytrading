"""Regression tests for problems found by running the checker against ~36 real small-business sites."""
from conftest import FakeFetcher, GOOD_HTML, SECURE_HEADERS, SITEMAP_XML, healthy_routes, resp

from app.pipeline import run_check

HOST = "acme.example"
BASE = f"https://{HOST}"


def run(routes):
    return run_check(HOST, fetcher=FakeFetcher(routes))


def ids(r):
    return {f["id"]: f for f in r["findings"]}


# --- speed is judged after removing network distance ----------------------------------------

def test_distance_is_not_blamed_on_the_server():
    routes = healthy_routes()
    # 1.8s total but 0.5s round trip x3 handshake trips = 1.5s of distance -> 0.3s of server time
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML, headers=SECURE_HEADERS, ttfb=1.8, rtt=0.5)
    assert "slow_response" not in ids(run(routes))


def test_genuinely_slow_server_is_flagged_with_the_maths():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML, headers=SECURE_HEADERS, ttfb=5.0, rtt=0.1)
    f = ids(run(routes))["slow_response"]
    assert f["severity"] == "medium" and "4.7s of server time" in f["evidence"] and "network distance" in f["evidence"]


def test_moderately_slow_is_low():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML, headers=SECURE_HEADERS, ttfb=2.2, rtt=0.05)
    assert ids(run(routes))["slow_response"]["severity"] == "low"


# --- page weight ------------------------------------------------------------------------------

def test_heavy_html_tiers_and_transfer_size():
    routes = healthy_routes()
    pad = "<!-- " + "x" * 700_000 + " -->"
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML + pad, headers=SECURE_HEADERS, transfer_bytes=90_000)
    f = ids(run(routes))["heavy_html"]
    assert f["severity"] == "low" and "90 KB after compression" in f["evidence"]
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML + "<!-- " + "x" * 1_100_000 + " -->", headers=SECURE_HEADERS)
    assert ids(run(routes))["heavy_html"]["severity"] == "medium"


# --- sitemaps ---------------------------------------------------------------------------------

IMAGE_SITEMAP = """<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
<url><loc>https://acme.example/</loc><image:image><image:loc>https://acme.example/wp-content/missing.jpg</image:loc></image:image></url>
<url><loc>https://acme.example/about</loc></url></urlset>"""


def test_image_urls_in_a_sitemap_are_not_treated_as_pages():
    routes = healthy_routes()
    routes[f"{BASE}/sitemap.xml"] = resp(f"{BASE}/sitemap.xml", body=IMAGE_SITEMAP, headers={"content-type": "application/xml"})
    f = FakeFetcher(routes)
    r = run_check(HOST, fetcher=f)
    assert "sitemap_broken" not in ids(r)
    assert not any("missing.jpg" in u for u, _ in f.calls)
    assert any("2 pages listed" in g for g in r["good"])


def _sitemap_of(n):
    urls = "".join(f"<url><loc>https://acme.example/p{i}</loc></url>" for i in range(n))
    return f'<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'


def test_one_bad_sample_is_low_two_is_medium():
    routes = healthy_routes()
    routes[f"{BASE}/sitemap.xml"] = resp(f"{BASE}/sitemap.xml", body=_sitemap_of(3), headers={"content-type": "application/xml"})
    for i in range(3):
        routes[f"{BASE}/p{i}"] = resp(f"{BASE}/p{i}", body="ok")
    routes[f"{BASE}/p0"] = resp(f"{BASE}/p0", status=500, body="err")
    assert ids(run(routes))["sitemap_broken"]["severity"] == "low"
    routes[f"{BASE}/p2"] = resp(f"{BASE}/p2", status=404, body="nf")
    assert ids(run(routes))["sitemap_broken"]["severity"] == "medium"


def test_blocked_sitemap_samples_are_not_blamed_on_the_sitemap():
    routes = healthy_routes()
    routes[f"{BASE}/sitemap.xml"] = resp(f"{BASE}/sitemap.xml", body=_sitemap_of(3), headers={"content-type": "application/xml"})
    for i in range(3):
        routes[f"{BASE}/p{i}"] = resp(f"{BASE}/p{i}", status=403, body="denied")
    assert "sitemap_broken" not in ids(run(routes))


# --- AI crawlers ------------------------------------------------------------------------------

def test_rate_limiting_429_is_not_a_block():
    routes = healthy_routes()
    routes[f"{BASE}/"] = lambda h: resp(f"{BASE}/", status=429 if "GPTBot" in h.get("User-Agent", "") else 200,
                                        body=GOOD_HTML, headers=SECURE_HEADERS)
    assert "ai_crawlers_blocked" not in ids(run(routes))


def test_403_for_one_bot_is_flagged_and_names_only_that_bot():
    routes = healthy_routes()
    routes[f"{BASE}/"] = lambda h: resp(f"{BASE}/", status=403 if "CCBot" in h.get("User-Agent", "") else 200,
                                        body=GOOD_HTML, headers=SECURE_HEADERS)
    f = ids(run(routes))["ai_crawlers_blocked"]
    assert "CCBot: HTTP 403" in f["evidence"] and "GPTBot" not in f["evidence"]


def test_our_own_identifier_is_in_every_ai_bot_request():
    routes = healthy_routes()
    f = FakeFetcher(routes)
    run_check(HOST, fetcher=f)
    bot_calls = [h["User-Agent"] for _u, h in f.calls if "User-Agent" in h]
    assert len(bot_calls) == 4 and all("TelaLoomSiteCheck/1.0" in ua for ua in bot_calls)


# --- analytics on hosted builders -------------------------------------------------------------

NO_ANALYTICS_HTML = GOOD_HTML.replace('<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>', "")


def test_builder_sites_get_a_note_not_a_no_analytics_finding():
    routes = healthy_routes()
    html = NO_ANALYTICS_HTML.replace("</head>", '<script src="https://static.wixstatic.com/x.js"></script></head>')
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=html, headers=SECURE_HEADERS)
    r = run(routes)
    assert "no_analytics" not in ids(r)
    assert any("built-in analytics" in n and "Wix" in n for n in r["notes"])
    assert r["status"] == "complete"  # a note is not a failed check


def test_shopify_analytics_signals_count_as_analytics():
    routes = healthy_routes()
    html = NO_ANALYTICS_HTML.replace("</head>", '<script>window.ShopifyAnalytics = {};var trekkie=[]</script></head>')
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=html, headers=SECURE_HEADERS)
    r = run(routes)
    assert "no_analytics" not in ids(r) and any("Shopify Analytics" in g for g in r["good"])


def test_plain_site_with_no_analytics_is_still_flagged():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=NO_ANALYTICS_HTML, headers=SECURE_HEADERS)
    assert "no_analytics" in ids(run(routes))


# --- outcome thresholds -----------------------------------------------------------------------

def test_four_significant_findings_across_two_areas_is_a_setup_sized_job():
    bare = "<html><head><title>Old site</title></head><body><h1>Hi</h1></body></html>"
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=bare, headers=SECURE_HEADERS)
    r = run(routes)
    # missing_description, no_structured_data, no_viewport (findability) + no_analytics (measurement)
    assert {"missing_description", "no_structured_data", "no_viewport", "no_analytics"} <= set(ids(r))
    assert r["outcome"] == "setup_scale"


def test_only_minor_findings_do_not_trigger_a_pitch():
    from app.findings import Finding
    from app.report import compute_outcome
    lows = [Finding(f"l{i}", "findability", "low", "t", "d") for i in range(4)]
    assert compute_outcome(lows, "complete")[0] == "nothing_major"
    assert compute_outcome(lows + [Finding("l5", "speed", "low", "t", "d")], "complete")[0] == "small_fixes"
    assert compute_outcome([Finding("m", "findability", "medium", "t", "d")], "complete")[0] == "small_fixes"


def test_three_significant_findings_is_only_small_fixes():
    html = NO_ANALYTICS_HTML.replace('<meta name="description" content="Licensed Brisbane plumbers, 24/7 emergency callouts.">', "") \
        .replace('<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Acme Plumbing"}</script>', "")
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=html, headers=SECURE_HEADERS)
    r = run(routes)
    assert {"missing_description", "no_structured_data", "no_analytics"} == set(ids(r))
    assert r["outcome"] == "small_fixes"
