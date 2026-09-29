"""Turns a Site's raw findings into the report dict returned to the API.

The outcome is deliberately coarse and price-agnostic; the API owns the wording and the
numbers. Thresholds are first-pass guesses to be tuned against real sites (see task #1028).
"""
from .findings import GROUPS, REBUILD_IDS

CHECKER_VERSION = "1.0"

_SEV_ORDER = {"high": 0, "medium": 1, "low": 2}


def compute_outcome(findings, status: str) -> tuple:
    """Return (outcome, rebuild_signal_ids)."""
    if status in ("blocked", "unreachable", "opted_out"):
        return "not_enough_data", []
    rebuild = [f.id for f in findings if f.id in REBUILD_IDS]
    if rebuild:
        return "rebuild_signal", rebuild
    high = [f for f in findings if f.severity == "high"]
    medium_plus = [f for f in findings if f.severity in ("high", "medium")]
    groups = {f.group for f in medium_plus}
    lows = [f for f in findings if f.severity == "low"]
    if len(high) >= 2 or (len(medium_plus) >= 4 and len(groups) >= 2):
        return "setup_scale", []
    # Only minor findings (a stray missing heading, no llms.txt...) don't justify a sales pitch: we
    # tell people plainly when they don't need us.
    if medium_plus or len(lows) >= 5:
        return "small_fixes", []
    return "nothing_major", []


def build_report(site, domain: str, status: str, *, started: float, finished: float,
                 checked_at: str, final_url: str = "", reason: str = "") -> dict:
    findings = sorted(site.findings, key=lambda f: (_SEV_ORDER[f.severity], GROUPS.index(f.group)))
    outcome, rebuild_ids = compute_outcome(findings, status)
    counts = {"high": 0, "medium": 0, "low": 0}
    for f in findings:
        counts[f.severity] += 1
    return {
        "domain": domain,
        "checkedAt": checked_at,
        "status": status,
        "statusReason": reason,
        "finalUrl": final_url,
        "platform": site.platform,
        "findings": [f.to_dict() for f in findings],
        "good": list(site.good),
        "notTested": list(site.not_tested),
        "notes": list(site.notes),
        "counts": counts,
        "groupsAffected": sorted({f.group for f in findings if f.severity in ("high", "medium")}),
        "outcome": outcome,
        "rebuildSignals": rebuild_ids,
        "meta": {
            "requests": site.fetcher.requests_made,
            "durationMs": int((finished - started) * 1000),
            "checkerVersion": CHECKER_VERSION,
        },
    }
