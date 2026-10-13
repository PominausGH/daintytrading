---
title: "Running Multiple LLMs in Production: Beyond the Gateway"
description: "A gateway normalises requests, not operations. Here's what still breaks across providers: logs, cost tracking, schema drift, and failover that was never tested."
category: "AI · Infrastructure"
publishedDate: "2026-10-14"
readTime: "6 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

A gateway makes two providers look like one at the request level. It does not make them behave like one in operations. The hard part of running multiple LLMs is everything after the call returns: logs you can compare, cost you can trust, output shapes your code can rely on, and a fallback that has actually been exercised. If you skip those, the second provider is a liability that only shows itself during an outage.

## The wrong approach: add a provider, ship it

The usual path is incremental. You add a second model for cost or resilience, wrap both behind one function, and call it done. The function returns a string. Everything provider-specific gets flattened or dropped.

That seems reasonable until you need an answer to a simple question. Why did costs jump on Tuesday? Which model produced this bad output? Was this response a primary result or a fallback? If the wrapper discarded the stop reason, the cached-token count and the model version, you can't say.

The other common mistake is treating failover as a try/except. Primary fails, call the secondary with the same prompt. That assumes the secondary has the same context window, the same tokenizer, the same tool-calling format and the same tolerance for your prompt. None of those are true by default. We covered the baseline reliability work in [rate limits, retries and timeouts](/blog/rate-limits-retries-timeouts-ai-reliability.html). This article is about what sits on top of it.

## Log one record shape, not many

Every call, whatever the provider, should emit the same record. Not the provider's response object. Your own schema, written by your wrapper:

{
  "request_id": "...",
  "feature": "reply_draft",
  "provider": "anthropic",
  "model": "claude-haiku-...",
  "prompt_version": "2026-09-30",
  "attempt": 2,
  "is_fallback": true,
  "input_tokens": 1840,
  "output_tokens": 212,
  "cached_input_tokens": 1500,
  "latency_ms": 2310,
  "stop_reason": "end_turn",
  "parsed_ok": true
}
Three fields matter more than they look. feature lets you slice cost and quality by product surface rather than by provider. prompt_version lets you tie a regression to a prompt change, not a model change. is_fallback tells you how often you're really running on your second choice. We go deeper on why raw logs aren't enough in [our observability piece](/blog/llm-observability-logs-arent-enough.html).

## Compute cost when you log, not when you report

Providers bill differently. Cached input tokens are priced separately, output tokens cost more than input, and some providers count reasoning or tool tokens in ways others don't. If you reconstruct cost from a monthly invoice, you can't attribute it to a feature.

Keep a small price table in your own code, keyed by provider and model, with an effective date. Compute cost per call at write time and store it on the record. When prices change, add a row; don't edit the old one. Then historical cost stays correct and you can answer "what would last month have cost on the other model" with a query instead of a guess.

## Own the schema, not the SDK

Providers disagree on where the system prompt goes, how tool calls are shaped, what stop reasons are called, and how streaming events arrive. A gateway smooths some of this. Not all of it, and not forever.

Define your own internal types: a message, a completion, a tool call, a usage block. One adapter per provider maps into them, and nothing outside the adapter imports a vendor SDK type. Our own products call providers directly through a thin wrapper like this. BrightPath's tutor goes through OpenRouter and the provider can be switched with a single setting, which only works because nothing downstream knows which model answered.

Structured output deserves its own check. Validate every response against the same schema regardless of provider, and log parsed_ok. A model that returns valid JSON 99 times in 100 on one provider can behave differently on another. You want to see that in a metric, not in a customer ticket. The same applies to function calling, covered in [building reliable LLM tool use](/blog/reliable-external-tool-use-for-llms.html).

## Make failover earn its name

Robust failover is mostly about what you don't fail over on. A 400 for a malformed request will fail on the second provider too. Retry timeouts, 429s and 5xx. Fail fast on the rest.

Then check the fallback path against the same bar as the primary:

- **Context budget.** Truncate to the smaller window before the call, not after the error.
- **Output validation.** The fallback's answer passes the same parser and quality gates. Ghost Writer drafts with Claude and falls back to Gemini, and every article still goes through fact-checking and editor critique before it can publish, whichever model wrote it.
- **Rate limits.** Your secondary has its own quota. If you've never sent it real volume, a failover can turn one outage into two.
- **A circuit breaker.** After N consecutive failures, stop trying the primary for a window. Otherwise every request pays the primary's timeout before reaching the fallback.
- **A non-model fallback.** CV Matcher's final fallback isn't another LLM. It's a deterministic TF-IDF score when the call fails or the output doesn't parse. That layer can't go down with a vendor.

## Where this breaks

This is real overhead. A second provider means a second set of quirks, a second quota to monitor and a second place for prompts to drift. If you're a small team with one feature, a single provider and a good retry policy often beats a half-tested multi-provider setup. A fallback you've never run is a guess.

Prompts also don't port cleanly. A prompt tuned on one model will usually be worse on another, so "failover" may mean degraded output, not identical output. Decide in advance whether degraded is acceptable or whether an honest error is better. For some features, like anything that takes an action on a customer's behalf, an error is the right answer.

And model churn is a separate risk. Multi-provider setups help with outages, but they don't remove the need to plan for [model deprecation](/blog/ai-vendor-model-deprecation-risk.html).

## One thing to do this week

Add the record above to your LLM wrapper. It's an afternoon of work. Then force a failover in staging: point the primary at a bad key, send real-shaped traffic, and read the logs. Check that is_fallback is true, cost is computed, output validates and latency is acceptable. Whatever breaks is your actual failover plan, so fix it now.

If you're designing this across several providers and want a second opinion on the architecture, [Start a project](https://telaloom.com/contact.html) and tell us what you're running.

<!-- RELATED_START -->

## Related articles

- [What Breaks First When You Put an LLM in Production](https://telaloom.com/blog/what-breaks-first-llm-production-pipeline.html)
- [How to Manage LLM API Keys and Secrets in Production](https://telaloom.com/blog/manage-llm-api-keys-secrets-production.html)
- [How Do You Manage Long Context Windows in Production LLMs?](https://telaloom.com/blog/manage-long-context-windows-production-llms.html)
- [LLM Observability: Why Your Logs Aren't Enough](https://telaloom.com/blog/llm-observability-logs-arent-enough.html)

<!-- RELATED_END -->
