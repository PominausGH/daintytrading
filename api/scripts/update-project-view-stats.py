#!/usr/bin/env python3
"""
Pulls real view/visit counts from Umami and updates every spot on the site
that quotes them (case-study page, homepage/work cards, SEO service page).
The two full-sentence spots also get a "(as of <date>)" freshness label.
Run weekly via cron.

To bring another project's stats onto its pages once it's live and tracked
in Umami, add an entry to PROJECTS below.
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
        "html_files": [
            REPO_ROOT / "projects" / "shuttersmith.html",
            REPO_ROOT / "work.html",
            REPO_ROOT / "index.html",
            REPO_ROOT / "services" / "seo-geo-optimization.html",
        ],
    },
]

# Every spot on the site the visit count is quoted, across all of the above
# files. Each is anchored to Shuttersmith-specific surrounding text so it
# can't collide with unrelated "N real visits" stats elsewhere on the site
# (e.g. the AI-chat-referral stat on services/seo-geo-optimization.html).
# Harmless to run against a file that doesn't contain a given spot.
#
# The two full-sentence spots also carry a "(as of <date>)" freshness label,
# since they're prose making a specific claim; the short card blurbs and the
# bare stat box don't have room for it and just get the number.
DATED_VISIT_COUNT_PATTERNS = [
    r"[\d,]+ real visits(?: \(as of [^)]+\))?(?= &mdash;)",               # shuttersmith.html prose
    r"[\d,]+ real visits(?: \(as of [^)]+\))?(?= since tracking began)",  # seo-geo paragraph
]
VISIT_COUNT_PATTERNS = [
    r"(Visits since \w{3,9}</span><span>)[\d,]+",         # shuttersmith.html sidecard
    r"[\d,]+(?= real visits, majority via Google)",       # work.html / index.html cards
    r'(<div class="result-stat">)[\d,]+(?= visits</div>)',  # seo-geo result-stat box
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


def update_visit_count(html_file, visits, date_str):
    text = html_file.read_text()
    new_text, total = text, 0
    for pattern in DATED_VISIT_COUNT_PATTERNS:
        new_text, n = re.subn(
            pattern, f"{visits:,} real visits (as of {date_str})", new_text
        )
        total += n
    for pattern in VISIT_COUNT_PATTERNS:
        compiled = re.compile(pattern)
        repl = rf"\g<1>{visits:,}" if compiled.groups else f"{visits:,}"
        new_text, n = compiled.subn(repl, new_text)
        total += n
    if total == 0:
        return False
    if new_text == text:
        print(f"  {html_file.name}: already {visits:,}, no change")
        return False
    html_file.write_text(new_text)
    print(f"  {html_file.name}: updated {total} spot(s) to {visits:,} real visits")
    return True


def main():
    token = get_token(_load_password())
    now = datetime.now(timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    date_str = now.strftime("%-d %b %Y")

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
        for html_file in project["html_files"]:
            update_visit_count(html_file, visits, date_str)


if __name__ == "__main__":
    main()
