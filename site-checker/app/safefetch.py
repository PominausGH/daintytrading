"""SSRF-safe HTTP fetcher.

The public site checker fetches URLs that a stranger typed into a web form, so every
request goes through here. Rules, all enforced in code (not by network policy alone):

- http/https only, ports 80/443 only, no userinfo, no IP-literal hosts.
- The hostname is resolved by us; *every* resolved address must be a public, globally
  routable IP (private, loopback, link-local, CGNAT, multicast, reserved, cloud-metadata
  and IPv6 forms that embed those - IPv4-mapped, 6to4, NAT64, Teredo - are all rejected).
- We then connect to the validated IP directly (Host header + TLS SNI set to the hostname,
  certificate still verified against the hostname), so DNS rebinding between "check" and
  "connect" cannot swap in an internal address.
- Redirects are followed manually, up to 5 hops, and every hop is re-validated.
- Hard caps: bytes per response, requests per check, seconds per check, seconds per request.
- Non-text bodies are never read. No cookies, no credentials, GET only.

`allow_private=True` exists solely for the test-suite (fixtures listen on 127.0.0.1); the
server never passes it.
"""
import ipaddress
import socket
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin, urlsplit

import httpx

USER_AGENT = "TelaLoomSiteCheck/1.0 (+https://telaloom.com/site-check.html#about)"
MAX_REDIRECTS = 5
DEFAULT_MAX_BYTES = 1_500_000
DEFAULT_MAX_REQUESTS = 30
DEFAULT_DEADLINE_SECONDS = 55.0
_DNS_TIMEOUT = 5.0
_TEXTY = ("text/", "application/xml", "application/xhtml", "application/json",
          "application/ld+json", "application/rss", "application/atom", "image/svg")

_dns_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="sitecheck-dns")


class FetchError(Exception):
    """kind is one of: dns, blocked, timeout, tls, connect, protocol, budget, scheme, other."""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind
        self.message = message


@dataclass
class Response:
    url: str
    status: int
    headers: dict
    body: bytes = b""
    ttfb: float = 0.0
    truncated: bool = False
    redirects: list = field(default_factory=list)  # [(from_url, status)]
    ip: str = ""
    rtt: float = 0.0             # TCP connect round-trip to the server, seconds (network distance)
    transfer_bytes: int = 0      # bytes actually sent over the wire (compressed)

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "").split(";")[0].strip().lower()

    @property
    def text(self) -> str:
        charset = "utf-8"
        ct = self.headers.get("content-type", "")
        if "charset=" in ct.lower():
            charset = ct.lower().split("charset=", 1)[1].split(";")[0].strip().strip("\"'") or "utf-8"
        try:
            return self.body.decode(charset, errors="replace")
        except LookupError:
            return self.body.decode("utf-8", errors="replace")


def is_public_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return is_public_ip(str(ip.ipv4_mapped))
        if ip.sixtofour is not None:
            return is_public_ip(str(ip.sixtofour))
        if ip.teredo is not None:
            return False
        if ip in ipaddress.ip_network("64:ff9b::/96"):
            return is_public_ip(str(ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)))
        if ip in ipaddress.ip_network("64:ff9b:1::/48"):
            return False
    return bool(ip.is_global) and not ip.is_multicast


def _format_ip(ip_str: str) -> str:
    return f"[{ip_str}]" if ":" in ip_str else ip_str


def _ssl_in_chain(exc: BaseException) -> Optional[ssl.SSLError]:
    seen = set()
    while exc is not None and id(exc) not in seen:
        if isinstance(exc, ssl.SSLError):
            return exc
        seen.add(id(exc))
        exc = exc.__cause__ or exc.__context__
    return None


class SafeFetcher:
    def __init__(self, *, allow_private: bool = False, user_agent: str = USER_AGENT,
                 max_requests: int = DEFAULT_MAX_REQUESTS,
                 deadline_seconds: float = DEFAULT_DEADLINE_SECONDS,
                 request_timeout: float = 8.0):
        self.allow_private = allow_private
        self.user_agent = user_agent
        self.max_requests = max_requests
        self.deadline = time.monotonic() + deadline_seconds
        self.requests_made = 0
        self._lock = threading.Lock()
        self._rtt_cache: dict = {}
        self._client = httpx.Client(
            follow_redirects=False,
            trust_env=False,
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=0),
            timeout=httpx.Timeout(connect=5.0, read=request_timeout, write=5.0, pool=5.0),
        )

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # -- resolution -------------------------------------------------------------------

    def _resolve_public(self, host: str) -> list:
        try:
            infos = _dns_pool.submit(socket.getaddrinfo, host, None, 0, socket.SOCK_STREAM).result(
                timeout=_DNS_TIMEOUT)
        except FuturesTimeout:
            raise FetchError("dns", "DNS lookup timed out")
        except socket.gaierror:
            raise FetchError("dns", "That domain doesn't resolve (DNS lookup failed)")
        ips = []
        for info in infos:
            ip = info[4][0].split("%", 1)[0]
            if ip not in ips:
                ips.append(ip)
        if not ips:
            raise FetchError("dns", "That domain doesn't resolve (no addresses)")
        if not self.allow_private:
            bad = [ip for ip in ips if not is_public_ip(ip)]
            if bad:
                raise FetchError("blocked", "That address points somewhere that can't be checked")
        ips.sort(key=lambda a: (":" in a, a))  # IPv4 first
        return ips

    def _rtt(self, ip: str, port: int) -> float:
        """Round-trip time to a (already validated) server, measured once per address via a bare TCP
        connect. Used only to separate network distance from server think-time in speed findings."""
        key = (ip, port)
        with self._lock:
            if key in self._rtt_cache:
                return self._rtt_cache[key]
        rtt = 0.0
        try:
            t0 = time.monotonic()
            with socket.create_connection((ip, port), timeout=3.0):
                rtt = time.monotonic() - t0
        except OSError:
            rtt = 0.0
        with self._lock:
            self._rtt_cache[key] = rtt
        return rtt

    # -- fetching ---------------------------------------------------------------------

    def get(self, url: str, *, headers: Optional[dict] = None, follow: bool = True,
            max_bytes: int = DEFAULT_MAX_BYTES, read_body: bool = True) -> Response:
        redirects = []
        current = url
        for _hop in range(MAX_REDIRECTS + 1):
            resp = self._one(current, headers or {}, max_bytes, read_body)
            resp.redirects = list(redirects)
            location = resp.headers.get("location")
            if follow and resp.status in (301, 302, 303, 307, 308) and location:
                redirects.append((current, resp.status))
                current = urljoin(current, location)
                continue
            return resp
        raise FetchError("protocol", "Too many redirects")

    def _one(self, url: str, headers: dict, max_bytes: int, read_body: bool) -> Response:
        if self.requests_made >= self.max_requests:
            raise FetchError("budget", "Request budget for this check used up")
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise FetchError("budget", "Time budget for this check used up")

        parts = urlsplit(url)
        if parts.scheme not in ("http", "https"):
            raise FetchError("scheme", "Only http and https are supported")
        if parts.username or parts.password:
            raise FetchError("blocked", "URLs with credentials aren't allowed")
        host = parts.hostname
        if not host:
            raise FetchError("scheme", "Missing host")
        port = parts.port or (443 if parts.scheme == "https" else 80)
        if not self.allow_private:
            if port not in (80, 443):
                raise FetchError("blocked", "Only ports 80 and 443 can be checked")
            try:
                ipaddress.ip_address(host)
            except ValueError:
                pass
            else:
                raise FetchError("blocked", "IP addresses can't be checked")

        ips = self._resolve_public(host) if not _is_ip(host) else [host]
        with self._lock:
            self.requests_made += 1

        path = parts.path or "/"
        if parts.query:
            path += "?" + parts.query
        req_headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Host": host if port in (80, 443) else f"{host}:{port}",
        }
        req_headers.update(headers)
        extensions = {"sni_hostname": host} if parts.scheme == "https" else {}

        last_err: Optional[FetchError] = None
        for ip in ips[:2]:
            target = f"{parts.scheme}://{_format_ip(ip)}:{port}{path}"
            rtt = self._rtt(ip, port)
            t0 = time.monotonic()
            try:
                with self._client.stream("GET", target, headers=req_headers, extensions=extensions,
                                         timeout=min(remaining, 10.0)) as r:
                    ttfb = time.monotonic() - t0
                    hdrs = {}
                    for k, v in r.headers.multi_items():
                        k = k.lower()
                        hdrs[k] = f"{hdrs[k]}, {v}" if k in hdrs else v
                    body = b""
                    truncated = False
                    ct = hdrs.get("content-type", "").lower()
                    is_text = ct == "" or any(ct.startswith(t) or t in ct for t in _TEXTY)
                    if read_body and is_text and r.status_code not in (204, 304):
                        chunks, size = [], 0
                        for chunk in r.iter_bytes():
                            size += len(chunk)
                            if size > max_bytes:
                                chunks.append(chunk[: max(0, max_bytes - (size - len(chunk)))])
                                truncated = True
                                break
                            chunks.append(chunk)
                            if time.monotonic() > self.deadline:
                                truncated = True
                                break
                        body = b"".join(chunks)
                    return Response(url=url, status=r.status_code, headers=hdrs, body=body,
                                    ttfb=ttfb, truncated=truncated, ip=ip, rtt=rtt,
                                    transfer_bytes=r.num_bytes_downloaded)
            except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.WriteTimeout, httpx.PoolTimeout):
                last_err = FetchError("timeout", "The site took too long to respond")
            except httpx.ConnectError as e:
                ssl_err = _ssl_in_chain(e)
                if ssl_err is not None or "CERTIFICATE" in str(e).upper() or "SSL" in str(e).upper():
                    last_err = FetchError("tls", _tls_message(ssl_err or e))
                else:
                    last_err = FetchError("connect", "Couldn't connect to the site")
            except (httpx.RemoteProtocolError, httpx.DecodingError, httpx.UnsupportedProtocol) as e:
                last_err = FetchError("protocol", f"The site sent an invalid response ({type(e).__name__})")
            except httpx.HTTPError as e:
                ssl_err = _ssl_in_chain(e)
                last_err = FetchError("tls", _tls_message(ssl_err)) if ssl_err else FetchError(
                    "other", f"Request failed ({type(e).__name__})")
            if last_err and last_err.kind == "tls":
                break  # a different IP won't fix a certificate problem
        raise last_err or FetchError("other", "Request failed")


def _is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _tls_message(exc: BaseException) -> str:
    text = str(exc)
    low = text.lower()
    if "expired" in low:
        return "The security certificate has expired"
    if "hostname" in low or "doesn't match" in low or "mismatch" in low:
        return "The security certificate is for a different domain name"
    if "self-signed" in low or "self signed" in low:
        return "The security certificate is self-signed"
    if "unable to get local issuer" in low or "unknown ca" in low or "certificate verify failed" in low:
        return "The security certificate isn't trusted by browsers"
    return "The secure (HTTPS) connection failed"
