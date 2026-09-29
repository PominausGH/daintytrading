from conftest import FakeFetcher, GOOD_HTML, SECURE_HEADERS, healthy_routes, resp

from app.pipeline import run_check
from app.safefetch import FetchError

HOST = "acme.example"
BASE = f"https://{HOST}"


def ids(report):
    return {f["id"] for f in report["findings"]}


def run(routes, host=HOST):
    return run_check(host, fetcher=FakeFetcher(routes))


def test_healthy_site_has_no_significant_findings():
    r = run(healthy_routes())
    assert r["status"] == "complete", r["notTested"]
    assert r["outcome"] == "nothing_major"
    assert r["counts"]["high"] == 0 and r["counts"]["medium"] == 0
    assert any("HTTPS" in g for g in r["good"])
    assert any("Sitemap" in g for g in r["good"])
    assert any("llms.txt" in g for g in r["good"])
    assert any("Analytics" in g for g in r["good"])
    assert r["platform"] == ""


def test_meta_reports_requests_and_version():
    r = run(healthy_routes())
    assert r["meta"]["requests"] > 5 and r["meta"]["checkerVersion"]
    assert r["finalUrl"] == f"{BASE}/"


def test_ai_crawlers_blocked_at_server():
    routes = healthy_routes()

    def ua_gate(headers):
        ua = headers.get("User-Agent", "")
        if "GPTBot" in ua or "ClaudeBot" in ua:
            return resp(f"{BASE}/", status=403, body="denied")
        return resp(f"{BASE}/", body=GOOD_HTML, headers=SECURE_HEADERS)

    routes[f"{BASE}/"] = ua_gate
    r = run(routes)
    f = next(f for f in r["findings"] if f["id"] == "ai_crawlers_blocked")
    assert f["severity"] == "medium" and "GPTBot: HTTP 403" in f["evidence"] and "ClaudeBot: HTTP 403" in f["evidence"]
    assert "PerplexityBot" not in f["evidence"]


def test_ai_crawlers_blocked_by_robots_txt():
    routes = healthy_routes()
    routes[f"{BASE}/robots.txt"] = resp(f"{BASE}/robots.txt", headers={"content-type": "text/plain"},
                                        body="User-agent: GPTBot\nDisallow: /\nUser-agent: *\nDisallow:\n")
    r = run(routes)
    f = next(f for f in r["findings"] if f["id"] == "ai_crawlers_blocked")
    assert "robots.txt" in f["evidence"] and "GPTBot" in f["evidence"]


def test_no_https_is_a_rebuild_signal():
    routes = {
        f"https://{HOST}/robots.txt": FetchError("connect", "Couldn't connect to the site"),
        f"http://{HOST}/robots.txt": resp(f"http://{HOST}/robots.txt", status=404, body="nf"),
        f"http://{HOST}/": resp(f"http://{HOST}/", body=GOOD_HTML),
    }
    r = run(routes)
    assert "no_https" in ids(r) and r["outcome"] == "rebuild_signal"
    assert "no_https" in r["rebuildSignals"]


def test_tls_error_is_high_but_not_a_rebuild_signal():
    routes = {
        f"https://{HOST}/robots.txt": FetchError("tls", "The security certificate has expired"),
        f"http://{HOST}/robots.txt": resp(f"http://{HOST}/robots.txt", status=404, body="nf"),
        f"http://{HOST}/": resp(f"http://{HOST}/", body=GOOD_HTML),
    }
    r = run(routes)
    f = next(f for f in r["findings"] if f["id"] == "tls_error")
    assert f["severity"] == "high" and "expired" in f["evidence"]
    assert r["outcome"] != "rebuild_signal"


def test_no_http_to_https_redirect():
    routes = healthy_routes()
    routes[f"http://{HOST}/"] = resp(f"http://{HOST}/", body=GOOD_HTML)
    assert "no_https_redirect" in ids(run(routes))


def test_eol_software_is_coarse_and_a_rebuild_signal():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML.replace("<head>", '<head><meta name="generator" content="WordPress 4.9.8">'),
                              headers={**SECURE_HEADERS, "x-powered-by": "PHP/5.6.40"})
    r = run(routes)
    f = next(f for f in r["findings"] if f["id"] == "eol_software")
    assert "PHP older than 8.1" in f["evidence"] and "WordPress older than 6.0" in f["evidence"]
    assert "5.6" not in f["evidence"] and "4.9" not in f["evidence"]  # no exact versions in the public report
    assert r["outcome"] == "rebuild_signal"
    assert r["platform"] == "WordPress"


def test_supported_php_is_not_flagged():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML, headers={**SECURE_HEADERS, "x-powered-by": "PHP/8.3.1"})
    assert "eol_software" not in ids(run(routes))


def test_noindex_and_robots_block_are_high():
    routes = healthy_routes()
    routes[f"{BASE}/robots.txt"] = resp(f"{BASE}/robots.txt", headers={"content-type": "text/plain"},
                                        body="User-agent: *\nDisallow: /\n")
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML.replace("<head>", '<head><meta name="robots" content="noindex,nofollow">'),
                              headers=SECURE_HEADERS)
    r = run(routes)
    assert {"noindex_home", "robots_blocks_all"} <= ids(r)
    assert r["outcome"] == "setup_scale"  # two high findings


def test_craig_style_site_is_setup_scale():
    bare = "<html><head></head><body><p>Welcome to our old site. Copyright 2016</p></body></html>"
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=bare, headers={"content-type": "text/html"}, ttfb=2.5)
    routes[f"{BASE}/sitemap.xml"] = resp(f"{BASE}/sitemap.xml", status=404, body="nf")
    routes[f"{BASE}/llms.txt"] = resp(f"{BASE}/llms.txt", status=404, body="nf")
    routes[f"{BASE}/robots.txt"] = resp(f"{BASE}/robots.txt", status=404, body="nf")

    def gate(headers):
        return resp(f"{BASE}/", body=bare, headers={"content-type": "text/html"}, ttfb=2.5) \
            if "GPTBot" not in headers.get("User-Agent", "") else resp(f"{BASE}/", status=403, body="no")

    routes[f"{BASE}/"] = gate
    r = run(routes)
    assert {"missing_title", "missing_description", "no_structured_data", "no_analytics", "no_viewport",
            "ai_crawlers_blocked", "slow_response", "stale_copyright", "security_headers"} <= ids(r)
    assert r["outcome"] == "setup_scale"
    assert set(r["groupsAffected"]) >= {"findability", "measurement"}
    sec = next(f for f in r["findings"] if f["id"] == "security_headers")
    assert sec["severity"] == "low"  # near-universal finding, never tips a report into a bigger job


def test_few_small_things_is_small_fixes():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML.replace("<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-XXXX\"></script>", ""),
                              headers=SECURE_HEADERS)
    r = run(routes)
    assert ids(r) == {"no_analytics"} and r["outcome"] == "small_fixes"


def test_bot_wall_reports_blocked_not_findings():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", status=403, body="<title>Just a moment...</title>", headers={"cf-mitigated": "challenge"})
    r = run(routes)
    assert r["status"] == "blocked" and r["outcome"] == "not_enough_data"
    assert not {"missing_title", "no_structured_data", "no_analytics"} & ids(r)
    assert r["notTested"] and "firewall" in r["notTested"][0]["reason"]


def test_challenge_page_with_200_is_also_blocked():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body="<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>")
    assert run(routes)["status"] == "blocked"


def test_unreachable_domain():
    r = run({f"https://{HOST}/robots.txt": FetchError("dns", "That domain doesn't resolve (DNS lookup failed)")})
    assert r["status"] == "unreachable" and r["outcome"] == "not_enough_data" and not r["findings"]


def test_homepage_timeout_is_unreachable_with_reason():
    routes = healthy_routes()
    routes[f"{BASE}/"] = FetchError("timeout", "The site took too long to respond")
    r = run(routes)
    assert r["status"] == "unreachable" and "couldn't connect" in r["statusReason"]
    assert "down" in r["statusReason"] and "block" in r["statusReason"]  # doesn't blame the site outright


def test_robots_opt_out_is_honoured_before_fetching_the_homepage():
    routes = healthy_routes()
    routes[f"{BASE}/robots.txt"] = resp(f"{BASE}/robots.txt", headers={"content-type": "text/plain"},
                                        body="User-agent: TelaLoomSiteCheck\nDisallow: /\n")
    f = FakeFetcher(routes)
    r = run_check(HOST, fetcher=f)
    assert r["status"] == "opted_out" and r["outcome"] == "not_enough_data"
    assert all(u.endswith("/robots.txt") for u, _ in f.calls)  # never touched the homepage


def test_broken_sitemap_sample_urls():
    routes = healthy_routes()
    routes[f"{BASE}/about"] = resp(f"{BASE}/about", status=404, body="nf")
    f = next(f for f in run(routes)["findings"] if f["id"] == "sitemap_broken")
    assert "/about -> 404" in f["evidence"]


def test_sitemap_urls_on_other_hosts_are_never_fetched():
    routes = healthy_routes()
    routes[f"{BASE}/sitemap.xml"] = resp(f"{BASE}/sitemap.xml", headers={"content-type": "application/xml"}, body=(
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        "<url><loc>http://169.254.169.254/latest/meta-data</loc></url>"
        "<url><loc>https://other.example/x</loc></url></urlset>"))
    f = FakeFetcher(routes)
    run_check(HOST, fetcher=f)
    assert not any("169.254" in u or "other.example" in u for u, _ in f.calls)


def test_soft_404_html_sitemap_is_not_a_sitemap():
    routes = healthy_routes()
    routes[f"{BASE}/sitemap.xml"] = resp(f"{BASE}/sitemap.xml", body="<!doctype html><html>Page not found</html>")
    assert "no_sitemap" in ids(run(routes))


def test_invalid_and_xxe_sitemaps_do_not_crash():
    routes = healthy_routes()
    routes[f"{BASE}/sitemap.xml"] = resp(f"{BASE}/sitemap.xml", headers={"content-type": "application/xml"}, body=(
        '<?xml version="1.0"?><!DOCTYPE urlset [<!ENTITY x SYSTEM "file:///etc/passwd">]>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>&x;</loc></url></urlset>'))
    r = run(routes)  # must not raise, must not leak file contents
    assert "root:" not in str(r)


def test_evidence_from_the_site_is_cleaned():
    routes = healthy_routes()
    evil = "<script>alert(1)</script>\n\x00" + "A" * 500
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=f"<html><head><title>{evil}</title></head><body><h1>x</h1></body></html>", headers=SECURE_HEADERS)
    r = run(routes)
    for f in r["findings"]:
        assert len(f["evidence"]) <= 200 and "\n" not in f["evidence"] and "\x00" not in f["evidence"]


def test_one_check_crashing_does_not_sink_the_report(monkeypatch):
    import app.pipeline as p

    def boom(site):
        raise RuntimeError("bug")

    monkeypatch.setattr(p, "check_measurement", boom)
    r = run(healthy_routes())
    assert r["status"] == "partial"
    assert any(n["check"] == "Analytics" for n in r["notTested"])
    assert r["findings"] is not None


def test_platform_detection_builders():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=GOOD_HTML.replace("</head>", '<script src="https://static.wixstatic.com/x.js"></script></head>'),
                              headers=SECURE_HEADERS)
    assert run(routes)["platform"] == "Wix"


def test_mixed_content_flagged_active_vs_passive():
    routes = healthy_routes()
    html = GOOD_HTML.replace("</head>", '<script src="http://cdn.example/x.js"></script></head>')
    routes[f"{BASE}/"] = resp(f"{BASE}/", body=html, headers=SECURE_HEADERS)
    f = next(f for f in run(routes)["findings"] if f["id"] == "mixed_content")
    assert f["severity"] == "medium"


def test_findings_sorted_high_first():
    routes = healthy_routes()
    routes[f"{BASE}/"] = resp(f"{BASE}/", body="<html><head></head><body></body></html>", headers={"content-type": "text/html"})
    sev = [f["severity"] for f in run(routes)["findings"]]
    assert sev == sorted(sev, key=["high", "medium", "low"].index)
