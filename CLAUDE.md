# CLAUDE.md

Guidance for Claude Code in this repo (TelaLoom / Dainty Trading: marketing site + `api/` backend).

## Layout (verified)
Astro site (`src/`, `public/`, `astro.config.mjs`) built to `dist/`, `api/` (Node backend: contact form, agreements/contracts, public site-check endpoints), `site-checker/` (Python service behind the public site checker), `nginx/`, `prompts/`, `marketing/`, `docker-compose.yml`.

## Public site checker

Free checker at `/site-check.html` (task #1028 in sb_tasks has the design decisions): visitor enters domain + email, gets an emailed 6-digit code, enters it, the check runs, the report shows on screen and is emailed; verified email + findings are logged to `api/data/sitecheck-leads.jsonl` and alerted to `CONTACT_NOTIFICATION_EMAIL`.
- **Two containers:** `daintytrading-api` (`api/lib/sitecheck.js`, `routes/site-check.js`: codes, sessions, jobs, report email, 24h per-domain cache) calls `daintytrading-site-checker` (`site-checker/`, Python, no published port, private `sitecheck-net`, read-only, no caps, no secrets). It never sees the visitor's email.
- **Security rule:** the checker fetches URLs strangers type in, so everything goes through `site-checker/app/safefetch.py` (public IPs only, ports 80/443, connect-by-validated-IP with TLS name check, every redirect re-validated, byte/request/time caps). Don't add another way to fetch a URL. Passive only: never probe, log in, submit forms or fetch unusual paths.
- **Tuning:** outcome thresholds are in `site-checker/app/report.py` (`compute_outcome`), wording and prices in `api/lib/sitecheck-copy.js` (mirrors `src/data/pricing.ts`). Thresholds were calibrated on ~36 real small-business sites; re-check the distribution after changing checks.
- **Tests:** `cd site-checker && python -m pytest tests` (deps in `requirements.txt` + pytest); `cd api && npm test` (Node built-in runner, needs `npm ci` first).
- **Deploy:** `/opt/docker/scripts/dainty-api-deploy.sh` rebuilds both `api` and `site-checker` when `api/`, `site-checker/` or `docker-compose.yml` change.
- **Client IP:** behind Cloudflare/NPM `req.ip` is always a proxy address; use `api/lib/client-ip.js` (`CF-Connecting-IP`) for anything per-visitor, e.g. rate-limit keys.

## Weekly ops (Tier A, Wednesday slot)

Cadence and rules live in `/opt/docker/scripts/weekly-rotation.json` and the `/weekly` skill; this is the repo-specific part.

**Growth goal (comes first each session):** customers using our web services — new web build / SEO / GEO clients. Levers: contact-form conversion (budget/source qualifiers are live), lead-sourcing + prospect outreach (don't cold-pitch web design to businesses already on DIY page builders), case studies and LinkedIn (`/linkedin-post`), the free domain-check as a bundled service, own-site SEO/GEO as proof of the offer. Read numbers from contact submissions in the API, Umami, `marketing-os/audits/daintytrading.com/` and `telaloom.com/`. Never estimate: say "not measured".

**Copy must be true.** 36 of 45 blog posts once carried invented stacks/evals/claims. No invented stats, testimonials, or tech claims; use the `dainty-voice` skill for tone. `ghost_writer` pushes blog posts here twice weekly.

**Deploy definition of done:** a PR is done only when live-verified.
- Web: `/opt/docker/scripts/dainty-deploy-build.sh` (5-min cron): ff-only pull + `npm run build` + `dist/` refresh, last successful build sha in `backups/logs/dainty-deploy-build.state`. `nginx.conf` changes need a container recreate; the script only rebuilds `dist/`.
- API: `/opt/docker/scripts/dainty-api-deploy.sh` (path-scoped to `api/`; the API image bakes code in at build time).
- Both **skip** if the live checkout is dirty or has a local commit not on `origin/master`. The nightly `git-sync-all` autosync commits stray files (e.g. `.playwright-mcp/` logs) and its HTTPS push can fail, leaving exactly that commit and blocking the next deploy. If a merge doesn't appear, run `git status` and `git log origin/master..HEAD` in `/opt/docker/dainty` and read `backups/logs/dainty-deploy-build.log`.

**Contracts:** paying-client agreement flow is here; a CSP once blocked signing for weeks. Re-test signing after any CSP or `nginx.conf` change.
