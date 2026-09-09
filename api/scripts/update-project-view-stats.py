#!/usr/bin/env python3
"""
Pulls real view/visit counts from Umami and writes them to api/data/project-stats.json.

The site used to be raw HTML, so this script sed-replaced the numbers directly
into rendered pages. Post-Astro-migration the site is a static build — editing
`.html` output would just get overwritten by the next build — so instead this
writes a small JSON file that api/routes/project-stats.js serves, and the
Shuttersmith case-study page fetches client-side at runtime. No rebuild needed
when stats update; run weekly via cron same as before.

To bring another project's stats onto its pages once it's live and tracked
in Umami, add an entry to PROJECTS below and reference its key from the
relevant .astro/.md page's fetch script.
"""
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

UMAMI_URL = "http://localhost:3100"
USERNAME = "genmailing@gmail.com"
CREDS_FILE = "/opt/docker/umami/.umami_report_creds"
REPO_ROOT = Path(__file__).resolve().parents[2]
STATS_FILE = REPO_ROOT / "api" / "data" / "project-stats.json"

PROJECTS = [
    {"key": "shuttersmith", "site_id": "265c7bd8-3f8a-41f9-98d4-ccedc9594283"},
]


def _load_password():
    with open(CREDS_FILE) as f:
        return f.read().strip()


def get_token(password):
    data = json.dumps({"username": USERNAME, "password": password}).encode()
    req = urllib.request.Request(
        f"{UMAMI_URL}/api/auth/login",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    return json.load(urllib.request.urlopen(req))["token"]


def api_get(path, token, params=None):
    url = f"{UMAMI_URL}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    return json.load(urllib.request.urlopen(req))


def main():
    token = get_token(_load_password())
    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    date_str = now.strftime("%-d %b %Y")

    results = {}
    for project in PROJECTS:
        site_id = project["site_id"]
        website = api_get(f"/api/websites/{site_id}", token)
        created_at = datetime.fromisoformat(website["createdAt"].replace("Z", "+00:00"))
        start_ms = int(created_at.timestamp() * 1000)

        stats = api_get(
            f"/api/websites/{site_id}/stats",
            token,
            {"startAt": start_ms, "endAt": now_ms},
        )
        visits = stats.get("visits", 0)
        print(f"{website.get('name', site_id)}: {visits} visits since {created_at.date()}")
        results[project["key"]] = {
            "visits": visits,
            "trackingSince": created_at.date().isoformat(),
            "asOf": date_str,
            "updatedAt": now.isoformat(),
        }

    STATS_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATS_FILE.write_text(json.dumps(results, indent=2) + "\n")
    print(f"Wrote {STATS_FILE}")


if __name__ == "__main__":
    main()
