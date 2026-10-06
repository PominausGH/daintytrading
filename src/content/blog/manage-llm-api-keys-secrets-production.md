---
title: "How to Manage LLM API Keys and Secrets in Production"
description: "Keep LLM API keys out of env files and images: use a secrets manager, per-service keys, IAM roles where possible, and overlap-based rotation with no downtime."
category: "AI · Infrastructure"
publishedDate: "2026-10-07"
readTime: "6 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

Manage LLM API keys in production by storing them in a secrets manager, not in .env files or images. Issue one key per service and environment. Fetch keys at runtime through a short-lived cache. Rotate by running two valid keys side by side, never by swapping one in place. An LLM key is a spending credential as well as an access credential. A leaked one gets billed to you within minutes, so treat it like a payment card, not a config value.

## The common wrong approach

Most teams start with a .env file and a single org-wide key. That's fine for a prototype. It stops being fine when these things happen, and they usually happen together:

The key gets copied into a CI variable, a staging box, a teammate's laptop and a Slack thread. Nobody can say where all the copies are. The key is baked into a Docker image with ENV ANTHROPIC_API_KEY=... or passed as a plain environment variable, where it shows up in docker inspect and in crash dumps. Error reporters happily capture environment variables and request headers. One shared key means one blast radius: a bug in your internal prototype can exhaust the quota your customer-facing feature depends on.

Then someone needs to rotate it. Rotation means editing every copy and restarting everything at once, so nobody does it. The key lives for two years, and the day it leaks you find out you've never tested revoking it.

## The better approach

**1. Put keys in a secrets manager.** AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault all work. Pick whichever matches where you already run. The point is a single source of truth with access policies and an audit log. The app gets the secret at startup or on demand, using its own identity (an IAM role, a Vault AppRole or Kubernetes auth), not another static secret. If you're on a single box with Docker Compose, mounted secret files (/run/secrets/...) are a big step up from environment variables. They don't appear in docker inspect, and you read them at runtime.

**2. Scope keys tightly.** Create a separate key per service and per environment, ideally in separate provider workspaces or projects. Both Anthropic and OpenAI support this. Set spend limits on each. When the batch job goes rogue, it hits its own ceiling, not production's. A key named after its owner (prod-support-bot) also makes the audit trail readable.

**3. Use dynamic credentials where they exist, and be honest about where they don't.** Vault's dynamic secrets are excellent for databases and cloud credentials: short-lived, unique per consumer, auto-revoked. But the major LLM providers don't issue short-lived API keys through a standard dynamic engine. Don't build a fantasy around it. Where you can, skip the static key entirely. If you call Claude through Bedrock or Vertex AI, or other models through their cloud equivalents, your workload authenticates with its IAM identity and there is no API key to leak. For direct provider APIs, the realistic goal is a long-lived key that is rarely exposed, easy to rotate, and scoped small.

**4. Rotate with overlap.** The sequence that avoids downtime:

- Create the new key at the provider. Both keys are now valid.
- Write the new key to the secrets manager. In AWS Secrets Manager, staged versions (AWSCURRENT, AWSPREVIOUS) support this directly.
- Let services pick it up. Cache the secret in memory with a TTL of a few minutes. On a 401 from the provider, re-fetch once and retry before failing. That single retry is what makes rotation invisible. It belongs alongside the rest of your [retry and timeout handling](https://daintytrading.com/blog/rate-limits-retries-timeouts-ai-reliability.html).
- Watch the old key's usage at the provider drop to zero. Then revoke it.

Automate it on a schedule. A rotation you've run twenty times is a non-event. One you've never run is an outage waiting for a bad day. Since providers mostly can't rotate their own keys for you, the automation is usually a small job that calls the provider's console or admin API, or a runbook with a calendar reminder if that's all you have.

**5. Keep keys server-side, and out of logs.** Never ship a provider key to a browser or mobile app. Proxy through your backend, where you can add per-user limits. Redact Authorization and x-api-key headers in your logging and error reporting. Turn on secret scanning in your repos (GitHub push protection, gitleaks, or similar) so a committed key is caught before it lands. Providers also scan public repos and may revoke leaked keys. That helps, but treat it as a backstop, not a control.

## Where this breaks

A secrets manager is another dependency. If your app fetches a secret on every request and the manager has a bad minute, you've coupled your uptime to it. Cache with a TTL and keep the last good value in memory when a refresh fails.

Vault is powerful and also real work to run: unsealing, HA, upgrades, policy design. For a small team with one or two services, a managed option (AWS Secrets Manager costs cents per secret per month) beats self-hosting Vault. Use Vault when you need dynamic database credentials or multi-cloud policy at scale, not because it's the famous one.

Per-service keys add admin overhead, and provider-side key management is clunkier than it should be. Spend limits are blunt: they stop the bleeding but also stop the feature. Finally, none of this helps if the secret is exfiltrated by a compromised dependency or a prompt-injected tool with shell access. Keep model-driven tools away from the process environment. Related data-handling concerns are covered in [how to keep data private when using external LLM APIs](https://telaloom.com/blog/data-privacy-security-external-llm-apis.html).

## Practical next step

This week, inventory every place each LLM key lives: CI, .env files, images, laptops, chat history, dashboards. Count the copies. Then do one dry-run rotation on your least critical service: create a second key, move that service to the secrets manager (or mounted files), add the retry-on-401 refetch, and revoke the old key. You'll find every hidden copy the hard way, on a service where it's cheap. If you want help designing this for a larger system, you can [Start a project](https://telaloom.com/contact.html) with us.
