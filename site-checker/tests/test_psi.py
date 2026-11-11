from conftest import FakeFetcher, healthy_routes

from app import psi
from app.pipeline import run_check


def run(monkeypatch, fetch=None, key="k"):
    if key:
        monkeypatch.setenv("PSI_API_KEY", key)
    else:
        monkeypatch.delenv("PSI_API_KEY", raising=False)
    if fetch:
        monkeypatch.setattr(psi, "fetch", fetch)
    return run_check("acme.example", fetcher=FakeFetcher(healthy_routes()))


def result(score):
    return lambda url: {"score": score, "lcp": 4.2, "cls": 0.1, "tbt": 300}


def test_no_key_means_no_psi_and_no_noise(monkeypatch):
    called = []
    r = run(monkeypatch, fetch=lambda u: called.append(u), key=None)
    assert not called and r["status"] == "complete"
    assert not any(f["id"].startswith("psi_") for f in r["findings"]) and r["notes"] == []


def test_poor_score_is_medium_speed_finding(monkeypatch):
    r = run(monkeypatch, fetch=result(32))
    f = next(f for f in r["findings"] if f["id"] == "psi_poor")
    assert f["severity"] == "medium" and f["group"] == "speed" and "32/100" in f["evidence"]
    assert r["score"]["pillars"]["performance"] < 100


def test_middling_score_is_low_and_good_score_is_a_pass(monkeypatch):
    assert any(f["id"] == "psi_needs_work" and f["severity"] == "low"
               for f in run(monkeypatch, fetch=result(75))["findings"])
    r = run(monkeypatch, fetch=result(96))
    assert not any(f["id"].startswith("psi_") for f in r["findings"])
    assert any("PageSpeed 96" in g for g in r["good"])


def test_psi_failure_is_a_note_and_keeps_report_complete(monkeypatch):
    def boom(url):
        raise psi.PsiError("Google's PageSpeed service is rate-limiting us right now")
    r = run(monkeypatch, fetch=boom)
    assert r["status"] == "complete" and r["notTested"] == []
    assert any("phone speed score" in n for n in r["notes"])


def test_key_never_appears_in_report(monkeypatch):
    import json
    r = run(monkeypatch, fetch=result(80), key="SECRET-KEY-123")
    assert "SECRET-KEY-123" not in json.dumps(r)
