# daintytrading.com → telaloom.com redirect map

This is a 1:1 rebrand, not a URL restructure — every path is identical on the new domain, only the hostname changes. Confirmed against `src/pages/sitemap.xml.ts`, which enumerates every real route at build time (static pages + the `projects` and `blog` content collections), so this list can't drift from what's actually live.

## What this means for the actual redirect config

Because every path is unchanged, this does **not** need a page-by-page URL mapping table. A single wildcard 301 rule is sufficient and correct:

```
https://daintytrading.com/(.*)  ->  https://telaloom.com/$1   (301, permanent)
```

Same pattern already used for the `wardframe.com` / `blackwall-labs.com` → `wisekeel.com` redirects (Nginx Proxy Manager "Redirection Host" with a regex path, `network_mode: host` NPM instance at `/opt/docker/npm/`).

## Route inventory (for reference / spot-checking after cutover)

**Static pages** (18):
```
/                                          /services/ai-product-builds.html
/work.html                                 /services/ai-automation-retrofit.html
/services.html                             /services/ai-infrastructure.html
/about.html                                /services/seo-geo-optimization.html
/contact.html                              /services/local-seo.html
/blog.html                                 /services/website-builds.html
/review.html
/australia.html
/uk.html
/usa.html
/privacy.html
/terms.html
```

**Dynamic collections** (path pattern only — count varies as content is added, don't treat these counts as fixed):
```
/projects/<slug>.html   — from the `projects` content collection (product showcases + client case studies)
/blog/<slug>.html       — from the `blog` content collection
```

## What's NOT in scope here

DNS/reverse-proxy wiring (NPM redirection host, Cloudflare Authenticated Origin Pulls on the new domain) is blocked on the Cloudflare API token in `dainty/api/.env` returning `403 Invalid access token` — that needs a working token or manual NPM/Cloudflare dashboard access, which is outside what this task could do. See the parent session's report for what's needed from the user there.
