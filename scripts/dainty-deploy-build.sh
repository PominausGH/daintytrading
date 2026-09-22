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
#
# 2026-09-12: node_modules was missing from the live checkout (cause unknown)
# and this script had no npm-install step, so `npm run build` failed on every
# run ("astro: not found") while still fetching/merging — PRs #31 and #32 sat
# merged-but-not-live with dist/ never updated. Now installs deps whenever
# they're missing before building.
#
# 2026-09-13: a build can still fail for other reasons (npm registry hiccup,
# a real syntax error, disk space, etc.) — and the old LOCAL-vs-REMOTE check
# ran *before* the build, so once `git pull` itself succeeded, HEAD already
# matched origin/master and every later tick silently skipped ("nothing new
# to pull") even though dist/ was never actually rebuilt. Tracked here: PR
# #32 sat merged-but-not-live for hours until manually caught and rebuilt.
# Fixed by tracking the last *successfully built* commit in a separate state
# file instead of relying on HEAD == origin/master — a failed build now
# retries every tick until it actually succeeds, regardless of whether a
# newer commit has landed since.
#
# 2026-09-13 (2nd issue same day): a stale root-level `.astro/` content-cache
# dir (untouched since the 2026-09-09 migration) made one specific blog post
# throw UnknownContentCollectionError on render, failing the whole build —
# unrelated to any actual code change, and it blocked PR #35 from deploying
# until caught and cleared by hand. Now wiped before every build so a stale
# cache can't silently block deploys again.
#
# 2026-09-15: the nginx/ config dir is bind-mounted into daintytrading-web too,
# but this script only ever rebuilds dist/ — a merged config change (e.g. a
# cache header fix) landed on disk via `git pull` but nginx kept serving its
# old, already-running config, since nothing here ever told it to reload.
# Documented as fixed at the time, but the actual reload code was never
# written — this comment describing it is all that ever existed. Caught
# 2026-09-22 when PR #69's CSP fix built, "deployed" per this script's own
# log, and still sat invisible on the live site.
#
# 2026-09-22: two separate bugs compounded here. First, the one above — no
# reload code actually existed. Second, even a bare `nginx -s reload` inside
# the container wouldn't have been enough on its own: `nginx/` used to be
# bind-mounted as a single file (nginx.conf -> conf.d/default.conf), and
# Docker pins a single-file bind mount to the inode it saw at container
# start. git's checkout/pull replaces a changed file via unlink+rename (a
# new inode), so the running container kept serving pre-change content no
# matter how many times nginx reloaded — only a full container recreate
# re-resolves a single-file bind mount. Fixed the mount itself in
# docker-compose.yml (now binds the whole `nginx/` directory, which re-reads
# fresh on every access, no inode-pinning), and actually wrote the reload
# step this comment always claimed existed.
#
# 2026-09-16: n8n's heartbeat monitor watches this log's mtime and alarms if
# it goes >20min untouched — but this script only ever *writes* to it on a
# skip/deploy/error, so a long quiet stretch with nothing new merged to
# master (normal overnight) looked identical to the cron having died,
# firing false heartbeat alerts (execution 30134). Now touches the log on
# every tick, even the silent no-op path, so mtime reflects cron liveness
# rather than deploy activity.
#
# 2026-09-18: the conditional `npm install` below left package-lock.json
# locally modified (npm re-resolving it slightly differently even with no
# real dependency change) after some earlier run, and nothing ever reset
# it — so the dirty-check below skipped on every single tick from then on,
# stuck 3+ hours until caught and fixed by hand (PR #52 sat merged but
# undeployed the whole time). package-lock.json is the only tracked file
# npm/astro touch as a side effect of installing/building, so it's now
# reset before the dirty-check runs, every tick, regardless of whether
# npm install actually ran this time.
#
# 2026-09-18 (2nd): Cal.com's "daintytrading" booking page description was
# hand-typed and drifted from real pricing/product counts. Every successful
# build now also runs scripts/sync-calcom-description.js, which pushes a
# description generated from src/data/pricing.ts + products.ts straight into
# Cal.com's own Postgres row. Deliberately non-fatal to this script — a
# Cal.com/DB hiccup must never block or fail the site's own deploy.
set -euo pipefail

REPO=/opt/docker/dainty
LOG=/opt/docker/backups/logs/dainty-deploy-build.log
STATE=/opt/docker/backups/logs/dainty-deploy-build.state
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

touch "$LOG"

cd "$REPO"

git checkout -- package-lock.json 2>/dev/null || true

if [ -n "$(git status --porcelain)" ]; then
  echo "[$TS] skip: working tree dirty" >> "$LOG"
  exit 0
fi

git fetch origin master --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)

if [ "$LOCAL" != "$REMOTE" ]; then
  if git merge-base --is-ancestor HEAD origin/master; then
    git pull --ff-only origin master --quiet
  else
    echo "[$TS] skip: local diverged from origin/master ($LOCAL vs $REMOTE), needs manual merge" >> "$LOG"
    exit 0
  fi
fi

CURRENT=$(git rev-parse HEAD)
LAST_DEPLOYED=$(cat "$STATE" 2>/dev/null || true)

if [ "$CURRENT" = "$LAST_DEPLOYED" ]; then
  exit 0
fi

if [ ! -x node_modules/.bin/astro ]; then
  npm install --silent >> "$LOG" 2>&1
fi

rm -rf .astro

if npm run build --silent >> "$LOG" 2>&1; then
  echo "$CURRENT" > "$STATE"
  echo "[$TS] deployed: ${LAST_DEPLOYED:-<none>} -> $CURRENT" >> "$LOG"

  if [ -z "$LAST_DEPLOYED" ] || ! git diff --quiet "$LAST_DEPLOYED" "$CURRENT" -- nginx/; then
    if docker exec daintytrading-web nginx -t >> "$LOG" 2>&1; then
      docker exec daintytrading-web nginx -s reload >> "$LOG" 2>&1
      echo "[$TS] nginx: config changed, reloaded" >> "$LOG"
    else
      echo "[$TS] nginx: ERROR — config changed but nginx -t failed, NOT reloading (old config still serving), needs manual fix" >> "$LOG"
    fi
  fi

  if node scripts/sync-calcom-description.js >> "$LOG" 2>&1; then
    echo "[$TS] calcom-sync: ok" >> "$LOG"
  else
    echo "[$TS] calcom-sync: ERROR — Cal.com description NOT updated, site deploy still succeeded, will retry next tick" >> "$LOG"
  fi
else
  echo "[$TS] ERROR: build failed for $CURRENT (last good: ${LAST_DEPLOYED:-<none>}) — dist/ NOT updated, will retry next tick" >> "$LOG"
fi
