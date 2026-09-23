---
title: "What Happens When Your AI Vendor Deprecates Your Model"
description: "Model deprecation is scheduled, not hypothetical — here's how to build AI integrations that survive it instead of breaking in production."
category: "AI · Infrastructure"
publishedDate: "2026-09-12"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

Your AI vendor will deprecate the model you're using in production. Not might — will. Anthropic, OpenAI, and Google all publish deprecation schedules and retire model versions on a rolling basis, typically with a few months of notice. If your integration calls a specific model string with no fallback and no monitoring for deprecation notices, you will find out it's happening from a 404 or a degraded response in production, not from a calendar reminder.

This isn't a rare edge case. It's a routine, scheduled event that most teams treat as someone else's problem until it's theirs.

## The common wrong approach

Most teams hard-code a model string — claude-3-5-sonnet-20241022, gpt-4-turbo, whatever worked well in testing — directly into application code, scattered across API call sites, cron jobs, and background workers. It seems reasonable: you picked the best model for the job, you pinned the version so behavior wouldn't drift, and you shipped.

The problem shows up six months to a year later, when the vendor sends a deprecation notice (or doesn't, and the endpoint just starts erroring). Now someone has to grep the codebase for every place that model string appears, test the replacement against every prompt that depends on it, and ship all of it under time pressure — because the shutoff date doesn't move. We've seen teams discover mid-incident that the same model string is referenced in four services, a serverless function nobody remembers deploying, and a partner's webhook handler that calls their API directly. Pinning a version was the right instinct. Pinning it in twelve places was the mistake.

## The better approach

Treat the model identifier as configuration, not code. On new builds, the model name lives in one place: an environment variable, a config service, or a thin internal gateway that every call routes through. Application code asks for "the summarization model" or "the classification model," not for claude-opus-4-20250514 by name. Swapping versions becomes a config change and a redeploy, not a code archaeology exercise.

A gateway is worth the extra layer once you're calling models from more than one or two places. It doesn't need to be elaborate — a small internal service or even a shared module that wraps the provider SDK — but it should own three things: the model string, retry and timeout behavior, and logging of which model handled which request. That last part matters more than people expect. When a new model version changes behavior subtly (shorter outputs, different tone, a refusal pattern that wasn't there before), you need to be able to correlate a spike in bad outputs with the exact version that produced them.

Second, subscribe to your vendor's deprecation notices directly, not secondhand. Anthropic and OpenAI both publish model deprecation pages and send notices to account admins — put those in a shared inbox or Slack channel that an engineer actually watches, not the founder's personal email. Put the deprecation date on a calendar the same day you get the notice, with a reminder at least three weeks out. Three weeks is enough time to test a replacement model against your eval set; it is not enough time to also discover the model string is hard-coded in four places.

Third, keep a small eval set — real prompts and expected-good outputs — for anything model-dependent that matters. When a new version comes out, run it against the eval set before you flip the config. This is the same discipline as a staging environment for a database migration: cheap insurance against a class of failure that's expensive to discover in production. If you're building something like this for the first time and want a second set of eyes on the architecture, that's the kind of scoping conversation we have with clients before [starting a project](https://telaloom.com/contact.html).

## Where this breaks

A gateway layer is overhead, and for a two-person team calling one model from one script, it's probably not worth building yet. If you have exactly one integration point and low request volume, a well-commented config variable and a calendar reminder cover most of the risk — don't build infrastructure for a problem you don't have yet.

The eval set is the part teams skip, and it's the part that actually saves you. Without one, "test the new model before switching" becomes "read a few outputs and hope," which catches obvious regressions but misses the subtle ones — a summarizer that starts dropping a field it used to include, a classifier that shifts its threshold. Building a real eval set takes real time up front, and small teams often decide that risk is acceptable. That's a legitimate call — just make it consciously, not by default.

## Practical next step

This week, grep your codebase for every literal model string — claude-, gpt-, gemini- — and count the distinct locations. If it's more than one, that's your answer: move the model identifier into a single config point before you need to change it under deadline pressure. Then go find your vendor's deprecation notice page and check whether the model you're running today has a retirement date already on it. It might.
