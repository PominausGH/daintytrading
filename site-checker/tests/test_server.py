import json
import threading
import time
import urllib.error
import urllib.request

import pytest

from app import server as server_mod


def _post(base, payload, raw=None):
    data = raw if raw is not None else json.dumps(payload).encode()
    req = urllib.request.Request(base + "/check", data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


@pytest.fixture()
def running(request):
    calls = []
    gate = threading.Event()
    gate.set()

    def fake_check(domain):
        calls.append(domain)
        gate.wait(5)
        return {"domain": domain, "status": "complete", "outcome": "nothing_major", "meta": {"requests": 1}}

    srv = server_mod.serve(host="127.0.0.1", port=0, check_fn=fake_check)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}", calls, gate
    gate.set()
    srv.shutdown()


def test_health(running):
    base, _, _ = running
    with urllib.request.urlopen(base + "/health", timeout=5) as r:
        assert json.loads(r.read()) == {"ok": True}


def test_check_normalises_the_domain(running):
    base, calls, _ = running
    code, body = _post(base, {"domain": "HTTPS://Example.com/some/path"})
    assert code == 200 and body["outcome"] == "nothing_major"
    assert calls == ["example.com"]


@pytest.mark.parametrize("payload", [
    {"domain": "127.0.0.1"}, {"domain": "localhost"}, {"domain": "169.254.169.254"},
    {"domain": "example.com:8080"}, {"domain": ""}, {"domain": None}, {"nope": 1}, [], "str",
])
def test_bad_domains_never_reach_the_checker(running, payload):
    base, calls, _ = running
    code, body = _post(base, payload)
    assert code == 400 and calls == []


def test_bad_json_and_oversize_rejected(running):
    base, calls, _ = running
    assert _post(base, None, raw=b"{not json")[0] == 400
    assert _post(base, None, raw=b"x" * 5000)[0] == 400
    assert _post(base, None, raw=b"")[0] == 400
    assert calls == []


def test_unknown_paths_404(running):
    base, _, _ = running
    req = urllib.request.Request(base + "/admin", data=b"{}")
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(req, timeout=5)
    assert e.value.code == 404


def test_busy_when_all_slots_taken(running, monkeypatch):
    base, calls, gate = running
    monkeypatch.setattr(server_mod, "_slots", threading.BoundedSemaphore(1))
    gate.clear()
    results = []
    t = threading.Thread(target=lambda: results.append(_post(base, {"domain": "slow.com"})))
    t.start()
    for _ in range(50):
        if calls:
            break
        time.sleep(0.05)
    code, body = _post(base, {"domain": "other.com"})
    assert code == 429 and body["code"] == "busy"
    gate.set()
    t.join(5)
    assert results[0][0] == 200


def test_checker_crash_is_a_500_without_details():
    def boom(domain):
        raise RuntimeError("secret internal detail")

    srv = server_mod.serve(host="127.0.0.1", port=0, check_fn=boom)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        code, body = _post(f"http://127.0.0.1:{srv.server_address[1]}", {"domain": "example.com"})
    finally:
        srv.shutdown()
    assert code == 500 and "secret" not in json.dumps(body)
