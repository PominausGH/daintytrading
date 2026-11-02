"""Known-bad software versions, matched against what a site already tells every visitor
(response headers, <meta generator>). Passive only: no extra requests, no probing.

To add an entry: append to ADVISORIES with a source link and the first fixed release per branch.
Entries are reviewed by a human before merge - a wrong "vulnerable" claim on a visitor's site is
worse than a missed one. Keep the list short: widely exploited, high-impact items only.

Caveat baked into the wording: hosts often hide or backport versions, so a match is "appears to
run", never a confirmed vulnerability.
"""
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Advisory:
    id: str
    name: str
    product: str  # "php"
    # branch (major, minor) -> first fixed patch level. Branches not listed and older than the
    # newest listed branch have no fix (end of life) and count as affected.
    fixed: dict
    source: str


ADVISORIES = (
    Advisory(
        id="php2shell",
        name="PHP2Shell (CVE-2026-109618 / CVE-2026-109619)",
        product="php",
        fixed={(8, 5): 12, (8, 4): 27, (8, 3): 36, (8, 2): 35},
        source="https://www.wiz.io/blog/php2shell-php-rce",
    ),
)

_PHP_RE = re.compile(r"php/(\d+)\.(\d+)\.(\d+)", re.I)


def php_version(headers: dict):
    """(major, minor, patch) from X-Powered-By, or None when absent or patch level hidden."""
    m = _PHP_RE.search({k.lower(): v for k, v in headers.items()}.get("x-powered-by", ""))
    return tuple(int(x) for x in m.groups()) if m else None


def affected_php(version, advisory: Advisory) -> bool:
    """True when `version` is below the fixed release for its branch (or on a branch with no fix)."""
    major, minor, patch = version
    newest = max(advisory.fixed)
    if (major, minor) in advisory.fixed:
        return patch < advisory.fixed[(major, minor)]
    # Unlisted branch: older than the newest fixed branch = end of life with no fix; newer = unknown
    return (major, minor) < newest


def check_headers(headers: dict) -> list:
    """Advisories that the publicly visible versions appear to match."""
    hits = []
    v = php_version(headers)
    if v:
        hits += [a for a in ADVISORIES if a.product == "php" and affected_php(v, a)]
    return hits
