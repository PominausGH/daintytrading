#!/bin/bash
# Keeps the live daintytrading-web container's `dist/` in sync with origin/master.
#
# Astro migration (2026-09-09): nginx now bind-mounts `dist/` (Astro's build
# output) instead of the repo root, so a merged PR — or Ghost Writer's own
# twice-weekly push — only reaches production once this checkout is pulled
# AND rebuilt. Mirrors /opt/docker/scripts/brightpath-deploy-pull.sh's proven
# pattern (added 2026-09-09 after merged BrightPath fixes sat live-broken for
# days with no pull automation), extended with a build step since this site
# now has one.
#
# Safety: only ever fast-forwards (--ff-only). If the working tree is dirty
# or history has diverged, it skips and logs — never discards local state.
# Only rebuilds when HEAD actually changed, so this is cheap to run every
# 5 minutes.
#
# NOT WIRED UP YET. To go live: copy this file to /opt/docker/scripts/, then
#   */5 * * * * /opt/docker/scripts/dainty-deploy-build.sh
# and run `npm install && npm run build` once by hand so dist/ exists before
# the first nginx restart after switching docker-compose.yml's mount.
set -euo pipefail

REPO=/opt/docker/dainty
LOG=/opt/docker/backups/logs/dainty-deploy-build.log
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cd "$REPO"

if [ -n "$(git status --porcelain)" ]; then
  echo "[$TS] skip: working tree dirty" >> "$LOG"
  exit 0
fi

git fetch origin master --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

if git merge-base --is-ancestor HEAD origin/master; then
  git pull --ff-only origin master --quiet
  if npm run build --silent >> "$LOG" 2>&1; then
    echo "[$TS] deployed: $LOCAL -> $(git rev-parse HEAD)" >> "$LOG"
  else
    echo "[$TS] ERROR: build failed after pulling $LOCAL -> $(git rev-parse HEAD) — dist/ NOT updated, previous build still serving" >> "$LOG"
  fi
else
  echo "[$TS] skip: local diverged from origin/master ($LOCAL vs $REMOTE), needs manual merge" >> "$LOG"
fi
