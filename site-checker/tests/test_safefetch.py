import gzip
import http.server
import socket
import threading

import pytest

from app import safefetch
from app.safefetch import FetchError, Response, SafeFetcher, is_public_ip


@pytest.mark.parametrize("ip", [
    "8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "203.0.114.1",
])
def test_public_ips_allowed(ip):
    assert is_public_ip(ip)


@pytest.mark.parametrize("ip", [
    "127.0.0.1", "127.1.2.3", "10.0.0.1", "172.16.5.4", "172.17.0.2", "192.168.1.1",
    "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "192.0.0.1",
    "198.18.0.1", "240.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254",
    "2002:7f00:0001::", "2002:0a00:0001::",          # 6to4 wrapping 127.0.0.1 / 10.0.0.1
    "64:ff9b::7f00:1", "64:ff9b::a00:1",            # NAT64 wrapping 127.0.0.1 / 10.0.0.1
    "2001::1",                                       # Teredo
    "not-an-ip", "",
])
def test_private_ips_rejected(ip):
    assert not is_public_ip(ip)


def _fetcher(**kw):
    return SafeFetcher(**kw)


def _patch_dns(monkeypatch, mapping):
    def fake(host, port, family=0, type=0, *a, **k):
        ips = mapping[host]
        return [(socket.AF_INET6 if ":" in ip else socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0)) for ip in ips]
    monkeypatch.setattr(safefetch.socket, "getaddrinfo", fake)


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://10.1.2.3/",
    "https://[::1]/", "http://[::ffff:127.0.0.1]/", "http://2130706433/",  # decimal 127.0.0.1
    "http://user:pw@example.com/", "ftp://example.com/", "file:///etc/passwd", "gopher://example.com/",
    "http://example.com:8080/", "http://example.com:22/", "https://example.com:6379/",
])
def test_one_rejects_dangerous_urls(url, monkeypatch):
    _patch_dns(monkeypatch, {"example.com": ["93.184.216.34"], "2130706433": ["127.0.0.1"]})
    f = _fetcher()
    with pytest.raises(FetchError) as e:
        f._one(url, {}, 1000, True)
    assert e.value.kind in ("blocked", "scheme", "dns")
    assert f.requests_made == 0


def test_one_rejects_host_resolving_to_private(monkeypatch):
    _patch_dns(monkeypatch, {"evil.example": ["10.0.0.5"], "mixed.example": ["93.184.216.34", "127.0.0.1"],
                             "meta.example": ["169.254.169.254"], "v6.example": ["::1"]})
    for host in ("evil.example", "mixed.example", "meta.example", "v6.example"):
        f = _fetcher()
        with pytest.raises(FetchError) as e:
            f._one(f"http://{host}/", {}, 1000, True)
        assert e.value.kind == "blocked", host
        assert f.requests_made == 0


def test_dns_failure_is_reported(monkeypatch):
    def boom(*a, **k):
        raise socket.gaierror("nope")
    monkeypatch.setattr(safefetch.socket, "getaddrinfo", boom)
    with pytest.raises(FetchError) as e:
        _fetcher()._one("http://nowhere.example/", {}, 1000, True)
    assert e.value.kind == "dns"


def test_every_redirect_hop_goes_through_validation(monkeypatch):
    f = _fetcher()
    seen = []
    hops = {
        "http://a.example/": Response("http://a.example/", 302, {"location": "https://b.example/x"}),
        "https://b.example/x": Response("https://b.example/x", 301, {"location": "http://169.254.169.254/latest"}),
    }

    def fake_one(url, headers, max_bytes, read_body):
        seen.append(url)
        if url in hops:
            return hops[url]
        return f.__class__._one(f, url, headers, max_bytes, read_body)  # real validation on the last hop

    monkeypatch.setattr(f, "_one", fake_one)
    with pytest.raises(FetchError) as e:
        f.get("http://a.example/")
    assert e.value.kind == "blocked"
    assert seen == ["http://a.example/", "https://b.example/x", "http://169.254.169.254/latest"]


def test_redirect_loop_is_capped(monkeypatch):
    f = _fetcher()
    monkeypatch.setattr(f, "_one", lambda url, *a: Response(url, 302, {"location": url + "x"}))
    with pytest.raises(FetchError) as e:
        f.get("http://a.example/")
    assert e.value.kind == "protocol"


def test_request_budget_enforced(monkeypatch):
    _patch_dns(monkeypatch, {"example.com": ["93.184.216.34"]})
    f = _fetcher(max_requests=0)
    with pytest.raises(FetchError) as e:
        f._one("http://example.com/", {}, 1000, True)
    assert e.value.kind == "budget"


def test_time_budget_enforced():
    f = _fetcher(deadline_seconds=-1)
    with pytest.raises(FetchError) as e:
        f._one("http://example.com/", {}, 1000, True)
    assert e.value.kind == "budget"


# -- end to end against a local fixture server (allow_private only ever set in tests) -------

class _Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        seen_ua.append(self.headers.get("User-Agent"))
        seen_host.append(self.headers.get("Host"))
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/final")
            self.end_headers()
        elif self.path == "/final":
            self._ok(b"<html>hello</html>", "text/html; charset=utf-8")
        elif self.path == "/big":
            self._ok(b"a" * 400_000, "text/html")
        elif self.path == "/image":
            self._ok(b"\x89PNG" + b"0" * 5000, "image/png")
        elif self.path == "/gz":
            data = gzip.compress(b"<html>" + b"x" * 5000 + b"</html>")
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()

    def _ok(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


seen_ua, seen_host = [], []


@pytest.fixture(scope="module")
def local_server():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


def test_fetch_follows_redirects_and_sets_ua(local_server):
    with SafeFetcher(allow_private=True) as f:
        r = f.get(local_server + "/redirect")
    assert r.status == 200 and r.text == "<html>hello</html>"
    assert r.redirects and r.redirects[0][1] == 302
    assert seen_ua[-1].startswith("TelaLoomSiteCheck/1.0")
    assert r.ttfb >= 0


def test_body_cap_truncates(local_server):
    with SafeFetcher(allow_private=True) as f:
        r = f.get(local_server + "/big", max_bytes=100_000)
    assert r.truncated and len(r.body) == 100_000


def test_non_text_body_not_read(local_server):
    with SafeFetcher(allow_private=True) as f:
        r = f.get(local_server + "/image")
    assert r.status == 200 and r.body == b""


def test_gzip_is_decoded_and_header_kept(local_server):
    with SafeFetcher(allow_private=True) as f:
        r = f.get(local_server + "/gz")
    assert r.headers["content-encoding"] == "gzip" and r.text.startswith("<html>")


def test_no_follow_returns_redirect(local_server):
    with SafeFetcher(allow_private=True) as f:
        r = f.get(local_server + "/redirect", follow=False)
    assert r.status == 302 and r.headers["location"] == "/final"


def test_connection_refused_is_connect_error():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    with SafeFetcher(allow_private=True) as f:
        with pytest.raises(FetchError) as e:
            f.get(f"http://127.0.0.1:{port}/")
    assert e.value.kind == "connect"


def test_tls_message_mapping():
    from app.safefetch import _tls_message
    assert "expired" in _tls_message(Exception("certificate has expired"))
    assert "different domain" in _tls_message(Exception("Hostname mismatch, certificate is not valid for 'x'"))
    assert "self-signed" in _tls_message(Exception("self-signed certificate"))
    assert "isn't trusted" in _tls_message(Exception("unable to get local issuer certificate"))
