from conftest import FakeFetcher, healthy_routes

from app.findings import Finding
from app.pipeline import run_check
from app.score import compute_score


def f(group, sev, id="x"):
    return Finding(id, group, sev, "t", "d")


def test_clean_findings_score_100():
    s = compute_score([], [], page_checked=True)
    assert s["overall"] == 100 and s["measured"] == 3 and s["topIssues"] == []


def test_deductions_and_overall_is_mean():
    s = compute_score([f("security", "high"), f("speed", "low")], [], page_checked=True)
    assert s["pillars"] == {"performance": 96, "quality": 100, "trust": 70}
    assert s["overall"] == round((96 + 100 + 70) / 3)


def test_unmeasured_pillar_excluded_not_zero():
    s = compute_score([f("security", "medium")], [{"check": "Speed", "reason": "timeout"}], page_checked=True)
    assert s["pillars"]["performance"] is None and s["measured"] == 2
    assert s["overall"] == round((100 + 88) / 2)


def test_insufficient_data_gives_no_number():
    assert compute_score([], [], page_checked=False)["overall"] is None
    skipped = [{"check": "Speed", "reason": ""}, {"check": "Page security", "reason": ""}]
    assert compute_score([], skipped, page_checked=True)["overall"] is None


def test_top_issues_ranked_by_gain_and_capped():
    fs = [f("security", "high", "a"), f("findability", "medium", "b"), f("findability", "low", "c"),
          f("speed", "low", "d"), f("measurement", "low", "e")]
    top = compute_score(fs, [], page_checked=True)["topIssues"]
    assert [t["id"] for t in top] == ["a", "b", "c"] and top[0]["gain"] == 10


def test_gain_capped_by_remaining_pillar_room():
    fs = [f("security", "high", str(i)) for i in range(5)]  # 150 deducted, pillar floors at 0
    s = compute_score(fs, [], page_checked=True)
    assert s["pillars"]["trust"] == 0 and all(t["gain"] <= 33 for t in s["topIssues"])


def test_report_includes_score():
    r = run_check("acme.example", fetcher=FakeFetcher(healthy_routes()))
    assert r["score"]["overall"] is not None and r["score"]["measured"] == 3
