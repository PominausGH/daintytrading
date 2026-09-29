import pytest

from app.domain import DomainError, normalize_domain


@pytest.mark.parametrize("raw,expected", [
    ("example.com", "example.com"),
    ("  Example.COM  ", "example.com"),
    ("https://example.com/path?x=1#frag", "example.com"),
    ("http://www.example.com.au/", "www.example.com.au"),
    ("example.com:443", "example.com"),
    ("example.com:80/", "example.com"),
    ("example.com.", "example.com"),
    ("bücher.de", "xn--bcher-kva.de"),
    ("sub.domain.acme.co.uk", "sub.domain.acme.co.uk"),
])
def test_good(raw, expected):
    assert normalize_domain(raw) == expected


@pytest.mark.parametrize("raw", [
    "", "   ", None, 123, "localhost", "127.0.0.1", "10.0.0.5", "169.254.169.254", "[::1]", "::1",
    "intranet", "printer.local", "router.lan", "site.internal", "x.test",
    "user:pass@example.com", "user@example.com", "ftp://example.com", "javascript://example.com",
    "example.com:8080", "example.com:22", "exa mple.com", "example..com", "-bad.example.com",
    "a" * 64 + ".com", "example.c", "example.123", "http://", "a." * 130 + "com",
    "example.com/../../etc/passwd" + " x",
])
def test_bad(raw):
    with pytest.raises(DomainError):
        normalize_domain(raw)


def test_path_is_dropped_not_rejected():
    assert normalize_domain("example.com/../../etc/passwd") == "example.com"
