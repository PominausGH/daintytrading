#!/bin/bash
# One-time setup for uptime-watch. Run on the VPS after the API with /api/monitor/* is deployed:
#   bash /opt/docker/dainty/cloudflare/uptime-watch/setup.sh
# Secrets go from api/.env straight into Cloudflare; nothing is printed.
set -euo pipefail
ROOT=/opt/docker/dainty
ENV_FILE="$ROOT/api/.env"
cd "$ROOT/cloudflare/uptime-watch"

code=$(curl -s -o /dev/null -w '%{http_code}' https://telaloom.com/api/monitor/sites)
if [ "$code" != 401 ] && [ "$code" != 503 ]; then
  echo "API doesn't serve /api/monitor yet (HTTP $code). Merge the PR and wait for the API deploy."; exit 1
fi

if ! grep -q '^MONITOR_SECRET=' "$ENV_FILE"; then
  echo "MONITOR_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
  echo "added MONITOR_SECRET to api/.env"
fi
docker compose -f "$ROOT/docker-compose.yml" up -d --force-recreate --no-deps api >/dev/null 2>&1
echo "API restarted with MONITOR_SECRET"

CLOUDFLARE_API_TOKEN="$(cat /root/.config/cf-reply-router.token)"
export CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"][0]["id"])')
export CLOUDFLARE_ACCOUNT_ID

[ -d node_modules ] || npm install --no-audit --no-fund >/dev/null 2>&1
npx wrangler deploy 2>&1 | grep -E 'Uploaded|Deployed|schedule|error|Error' || true

for k in MONITOR_SECRET PUSHOVER_APP_TOKEN PUSHOVER_USER_KEY; do
  grep "^$k=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' \
    | npx wrangler secret put "$k" >/dev/null 2>&1
  echo "set $k on the worker"
done
echo "done: uptime-watch runs every minute; check with: npx wrangler tail uptime-watch"
