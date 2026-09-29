"""Domain normalisation for the public site checker.

The checker only ever takes a bare domain (example.com). Anything that could point the
fetcher somewhere other than a public website (IP literals, localhost, internal TLDs,
userinfo, unusual ports) is rejected here, before any DNS lookup happens. The fetcher
re-validates every resolved IP independently (see safefetch.py) - this is only the first,
friendly layer.
"""
import ipaddress
import re

_LABEL_RE = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")
_SCHEME_RE = re.compile(r"^([a-z][a-z0-9+.-]*)://")
_BLOCKED_TLDS = {
    "local", "localhost", "internal", "lan", "home", "corp", "intranet", "test",
    "invalid", "example", "onion", "arpa", "localdomain",
}


class DomainError(ValueError):
    """Raised with a user-facing message."""


def normalize_domain(raw) -> str:
    if not isinstance(raw, str):
        raise DomainError("Enter your website address, like example.com")
    s = raw.strip().lower()
    if not s or len(s) > 300:
        raise DomainError("Enter your website address, like example.com")
    if any(c.isspace() for c in s):
        raise DomainError("That doesn't look like a website address")

    m = _SCHEME_RE.match(s)
    if m:
        if m.group(1) not in ("http", "https"):
            raise DomainError("Enter a normal website address, like example.com")
        s = s[m.end():]

    for sep in ("/", "?", "#"):
        s = s.split(sep, 1)[0]

    if "@" in s:
        raise DomainError("Enter just the website address, without a username")
    if s.startswith("["):
        raise DomainError("Enter a domain name, not an IP address")

    if ":" in s:
        host, _, port = s.partition(":")
        if port not in ("80", "443", ""):
            raise DomainError("Only standard websites (ports 80 and 443) can be checked")
        s = host

    s = s.rstrip(".")
    if not s:
        raise DomainError("Enter your website address, like example.com")

    try:
        ipaddress.ip_address(s)
    except ValueError:
        pass
    else:
        raise DomainError("Enter a domain name, not an IP address")

    try:
        s = s.encode("idna").decode("ascii")
    except UnicodeError:
        raise DomainError("That doesn't look like a valid website address")

    if len(s) > 253:
        raise DomainError("That doesn't look like a valid website address")
    labels = s.split(".")
    if len(labels) < 2 or not all(_LABEL_RE.match(label) for label in labels):
        raise DomainError("That doesn't look like a valid website address")
    tld = labels[-1]
    if tld in _BLOCKED_TLDS:
        raise DomainError("That address can't be checked from the public internet")
    if not (tld.startswith("xn--") or (tld.isalpha() and 2 <= len(tld) <= 24)):
        raise DomainError("That doesn't look like a valid website address")
    return s
