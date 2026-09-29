from dataclasses import dataclass, field
from typing import Optional

from bs4 import BeautifulSoup

from .findings import Finding, clean
from .safefetch import Response, SafeFetcher


@dataclass
class Site:
    host: str
    fetcher: SafeFetcher
    findings: list = field(default_factory=list)
    good: list = field(default_factory=list)
    not_tested: list = field(default_factory=list)   # checks that could not run (errors, budget)
    notes: list = field(default_factory=list)        # things we simply can't see from outside
    base: str = ""                    # scheme://host we reached (after redirects on the homepage)
    home: Optional[Response] = None
    soup: Optional[BeautifulSoup] = None
    robots: Optional[str] = None        # robots.txt text, None if not found
    https_ok: bool = False
    https_error_kind: str = ""          # "tls" | "connect" | "timeout" | "" ...
    https_error: str = ""
    blocked: bool = False               # a firewall/bot-wall turned our visit away
    platform: str = ""

    def add(self, id: str, group: str, severity: str, title: str, detail: str, evidence: str = ""):
        self.findings.append(Finding(id, group, severity, title, detail, evidence))

    # Anything that can contain text taken from the scanned site is passed through clean() here, so
    # no code path can put an unbounded or control-character-laden string into a report.

    def ok(self, text: str):
        text = clean(text, 300)
        if text not in self.good:
            self.good.append(text)

    def skip(self, check: str, reason: str):
        self.not_tested.append({"check": clean(check, 120), "reason": clean(reason, 400)})

    def note(self, text: str):
        text = clean(text, 400)
        if text not in self.notes:
            self.notes.append(text)

    def has(self, id: str) -> bool:
        return any(f.id == id for f in self.findings)
