"""Optional Google PageSpeed Insights lookup (mobile, performance category).

Only runs when PSI_API_KEY is set in the environment. The key is sent to a fixed Google host and is
never logged or put in an error message (httpx's own request logging is silenced for that reason).
Restrict the key to the PageSpeed Insights API in Google Cloud so a leak could only spend its quota.
"""
import logging
import os

import httpx

logging.getLogger("httpx").setLevel(logging.WARNING)

ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
TIMEOUT = 45.0


class PsiError(Exception):
    pass


def enabled() -> bool:
    return bool(os.environ.get("PSI_API_KEY"))


def fetch(url: str) -> dict:
    """Return {score, lcp, cls, tbt}: score 0-100, lcp in seconds, tbt in ms. Raises PsiError."""
    key = os.environ.get("PSI_API_KEY", "")
    if not key:
        raise PsiError("not configured")
    try:
        r = httpx.get(ENDPOINT, params={"url": url, "key": key, "strategy": "mobile", "category": "performance"},
                      timeout=TIMEOUT)
    except httpx.HTTPError:
        raise PsiError("Google's PageSpeed service didn't answer in time") from None
    if r.status_code == 429:
        raise PsiError("Google's PageSpeed service is rate-limiting us right now")
    if r.status_code != 200:
        raise PsiError(f"Google's PageSpeed service returned HTTP {r.status_code}")
    try:
        lh = r.json()["lighthouseResult"]
        audits = lh["audits"]
        score = round(float(lh["categories"]["performance"]["score"]) * 100)
        return {
            "score": score,
            "lcp": round(float(audits["largest-contentful-paint"]["numericValue"]) / 1000, 1),
            "cls": round(float(audits["cumulative-layout-shift"]["numericValue"]), 2),
            "tbt": round(float(audits["total-blocking-time"]["numericValue"])),
        }
    except (KeyError, TypeError, ValueError):
        raise PsiError("Google's PageSpeed service returned a result we couldn't read") from None
