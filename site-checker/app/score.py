"""Headline score for a site check: three pillars, overall, and a points-gain estimate per issue.

Same pillar logic as the internal /site-audit scorer (score-overall.py): Performance, Quality and
Trust & Security, overall = mean of the *measured* pillars, unmeasured pillars are excluded (never
averaged in as zero), and fewer than two measured pillars means no number at all.

Pillar score = 100 minus a deduction per finding. Deductions are first-pass guesses, like the outcome
thresholds in report.py, to be tuned against real sites.
"""
from .findings import GROUPS

DEDUCT = {"high": 30, "medium": 12, "low": 4}

# pillar -> finding groups it covers
PILLARS = {
    "performance": ("speed",),
    "quality": ("findability", "measurement"),
    "trust": ("security",),
}

# pillar -> pipeline check names; a pillar is unmeasured only if every one of its checks failed to run
_CHECKS = {
    "performance": {"Speed"},
    "quality": {"On-page SEO", "robots.txt", "Sitemap", "llms.txt", "AI-crawler access", "Analytics"},
    "trust": {"Page security"},
}
TOP_N = 3

assert {g for gs in PILLARS.values() for g in gs} == set(GROUPS)


def _pillar_of(group: str) -> str:
    return next(p for p, gs in PILLARS.items() if group in gs)


def _measured(page_checked: bool, not_tested: list) -> list:
    if not page_checked:
        return []
    skipped = {n.get("check") for n in not_tested}
    return [p for p, checks in _CHECKS.items() if not checks <= skipped]


def compute_score(findings, not_tested, *, page_checked: bool) -> dict:
    """`page_checked` is False when the homepage couldn't be read (blocked, unreachable, error page)."""
    measured = _measured(page_checked, not_tested)
    base = {"overall": None, "pillars": {p: None for p in PILLARS}, "measured": len(measured),
            "topIssues": [], "estimate": True}
    if len(measured) < 2:
        return base
    deficit = {p: 0 for p in measured}
    for f in findings:
        p = _pillar_of(f.group)
        if p in deficit:
            deficit[p] += DEDUCT[f.severity]
    pillars = {p: max(0, 100 - d) for p, d in deficit.items()}
    overall = round(sum(pillars.values()) / len(pillars))
    # Gain from fixing one finding: its deduction, capped by what is left in that pillar, spread over
    # the measured pillars (overall is their mean). A rough estimate, and labelled as one.
    gains = []
    for f in findings:
        p = _pillar_of(f.group)
        if p not in pillars:
            continue
        room = 100 - pillars[p]
        gains.append((round(min(DEDUCT[f.severity], room) / len(pillars)), DEDUCT[f.severity], f))
    gains.sort(key=lambda t: (t[0], t[1]), reverse=True)
    top = [{"id": f.id, "title": f.title, "severity": f.severity, "gain": g}
           for g, _, f in gains[:TOP_N] if g > 0]
    return {"overall": overall, "pillars": {p: pillars.get(p) for p in PILLARS}, "measured": len(measured),
            "topIssues": top, "estimate": True}
