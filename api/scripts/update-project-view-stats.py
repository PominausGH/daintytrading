#!/usr/bin/env python3
"""
Pulls real view/visit counts from Umami and updates the "Where we are"
stat line on the matching case-study page in this repo. Run weekly via cron.

To bring another project's stats onto its case-study page once it's live
and tracked in Umami, add an entry to PROJECTS below.
"""
import json
import re
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

UMAMI_URL = "http://localhost:3100"
USERNAME = "genmailing@gmail.com"
CREDS_FILE = "/opt/docker/umami/.umami_report_creds"
REPO_ROOT = Path(__file__).resolve().parents[2]

PROJECTS = [
    {
        "site_id": "265c7bd8-3f8a-41f9-98d4-ccedc9594283",
        "html_file": REPO_ROOT / "projects" / "shuttersmith.html",
    },
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


def update_visit_count(html_file, visits):
    text = html_file.read_text()
    new_text, n1 = re.subn(r"[\d,]+(?= real visits)", f"{visits:,}", text)
    new_text, n2 = re.subn(
        r"(Visits since \w{3,9}</span><span>)[\d,]+",
        rf"\g<1>{visits:,}",
        new_text,
    )
    total = n1 + n2
    if total == 0:
        print(f"  no visit-count patterns matched in {html_file}, skipping")
        return False
    if new_text == text:
        print(f"  {html_file.name}: already {visits:,}, no change")
        return False
    html_file.write_text(new_text)
    print(f"  {html_file.name}: updated {total} spot(s) to {visits:,} real visits")
    return True


def main():
    token = get_token(_load_password())
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

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
        update_visit_count(project["html_file"], visits)


if __name__ == "__main__":
    main()
