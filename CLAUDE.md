# CLAUDE.md

Guidance for Claude Code in this repo (TelaLoom / Dainty Trading: marketing site + `api/` backend).

## Layout (verified)
Astro site (`src/`, `public/`, `astro.config.mjs`) built to `dist/`, `api/` (Node backend: contact form, agreements/contracts), `nginx/`, `prompts/`, `marketing/`, `docker-compose.yml`.

## Weekly ops (Tier A, Wednesday slot)

Cadence and rules live in `/opt/docker/scripts/weekly-rotation.json` and the `/weekly` skill; this is the repo-specific part.

**Growth goal (comes first each session):** customers using our web services — new web build / SEO / GEO clients. Levers: contact-form conversion (budget/source qualifiers are live), lead-sourcing + prospect outreach (don't cold-pitch web design to businesses already on DIY page builders), case studies and LinkedIn (`/linkedin-post`), the free domain-check as a bundled service, own-site SEO/GEO as proof of the offer. Read numbers from contact submissions in the API, Umami, `marketing-os/audits/daintytrading.com/` and `telaloom.com/`. Never estimate: say "not measured".

**Copy must be true.** 36 of 45 blog posts once carried invented stacks/evals/claims. No invented stats, testimonials, or tech claims; use the `dainty-voice` skill for tone. `ghost_writer` pushes blog posts here twice weekly.

**Deploy definition of done:** a PR is done only when live-verified.
- Web: `/opt/docker/scripts/dainty-deploy-build.sh` (5-min cron): ff-only pull + `npm run build` + `dist/` refresh, last successful build sha in `backups/logs/dainty-deploy-build.state`. `nginx.conf` changes need a container recreate; the script only rebuilds `dist/`.
- API: `/opt/docker/scripts/dainty-api-deploy.sh` (path-scoped to `api/`; the API image bakes code in at build time).
- Both **skip** if the live checkout is dirty or has a local commit not on `origin/master`. The nightly `git-sync-all` autosync commits stray files (e.g. `.playwright-mcp/` logs) and its HTTPS push can fail, leaving exactly that commit and blocking the next deploy. If a merge doesn't appear, run `git status` and `git log origin/master..HEAD` in `/opt/docker/dainty` and read `backups/logs/dainty-deploy-build.log`.

**Contracts:** paying-client agreement flow is here; a CSP once blocked signing for weeks. Re-test signing after any CSP or `nginx.conf` change.
