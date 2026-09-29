"""Tiny internal HTTP service around the checker (stdlib only).

Endpoints:  GET /health   POST /check  {"domain": "example.com"}

Only the dainty API container can reach this (private docker network, no published port).
It never sees a visitor's email address - just the domain to check.
"""
import json
import logging
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .domain import DomainError, normalize_domain
from .pipeline import run_check

log = logging.getLogger("sitecheck")
MAX_CONCURRENT = int(os.environ.get("SITECHECK_MAX_CONCURRENT", "3"))
_slots = threading.BoundedSemaphore(MAX_CONCURRENT)


def make_handler(check_fn=run_check):
    class Handler(BaseHTTPRequestHandler):
        server_version = "sitecheck"
        sys_version = ""
        timeout = 10

        def log_message(self, fmt, *args):  # quiet default access log; we log our own line
            pass

        def _send(self, code: int, payload: dict):
            body = json.dumps(payload).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/health":
                return self._send(200, {"ok": True})
            self._send(404, {"error": "not found"})

        def do_POST(self):
            if self.path != "/check":
                return self._send(404, {"error": "not found"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                return self._send(400, {"error": "bad request", "code": "bad_request"})
            if length <= 0 or length > 2048:
                return self._send(400, {"error": "bad request", "code": "bad_request"})
            try:
                data = json.loads(self.rfile.read(length))
                domain = normalize_domain(data.get("domain") if isinstance(data, dict) else None)
            except DomainError as e:
                return self._send(400, {"error": str(e), "code": "bad_domain"})
            except (ValueError, UnicodeDecodeError):
                return self._send(400, {"error": "bad request", "code": "bad_request"})

            if not _slots.acquire(blocking=False):
                return self._send(429, {"error": "The checker is busy, try again in a minute", "code": "busy"})
            t0 = time.monotonic()
            try:
                report = check_fn(domain)
            except Exception:
                log.exception("check crashed for %s", domain)
                return self._send(500, {"error": "The check failed unexpectedly", "code": "internal"})
            finally:
                _slots.release()
            log.info("checked %s status=%s outcome=%s requests=%s in %.1fs", domain, report.get("status"),
                     report.get("outcome"), report.get("meta", {}).get("requests"), time.monotonic() - t0)
            self._send(200, report)

    return Handler


def serve(host: str = "0.0.0.0", port: int = 8000, check_fn=run_check) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), make_handler(check_fn))
    server.daemon_threads = True
    return server


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # it logs every fetched URL at INFO
    srv = serve(port=int(os.environ.get("PORT", "8000")))
    log.info("site-checker listening on :%s (max %s concurrent)", srv.server_address[1], MAX_CONCURRENT)
    srv.serve_forever()
