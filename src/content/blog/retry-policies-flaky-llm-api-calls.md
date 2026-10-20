---
title: "Retry Policies for Flaky LLM API Calls That Won't Cascade"
description: "How to retry LLM API calls safely: backoff with jitter, retry budgets, circuit breakers, and idempotent jobs, with TypeScript code you can adapt."
category: "Automation"
publishedDate: "2026-10-21"
readTime: "6 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

A good LLM retry policy has four parts. Retry only transient errors. Back off exponentially with jitter. Cap total retries with a budget and a circuit breaker. Make the work idempotent, so a retry can never do the same thing twice. Most outages blamed on "the provider being down" are really retry policies that turned a brief 529 into a self-inflicted traffic spike.

## The retry loop everyone writes first

It looks like this: wrap the SDK call in a for loop, catch any exception, sleep one second, try again, up to five times. It passes every test you write, because your tests never fail the way production does.

Here is where it breaks.

First, it retries everything. A 400 for a malformed request, a 401 for a revoked key and a context-length error will fail identically on every attempt. You burn latency and quota on a request that cannot succeed.

Second, the fixed delay synchronizes your clients. When the provider returns 429s or overload errors, every worker sleeps the same second and returns together. The provider sees a wave, rejects it, and the wave comes back.

Third, retries multiply. If three layers of your stack each retry five times, one user request becomes up to 125 upstream calls. Under a real incident, that is the cascade: your retries become the load that keeps the provider, or your own queue, down.

Fourth, nothing bounds the total time. A request with a 60-second timeout and five attempts can hold a connection for five minutes. We cover the timeout side in [rate limits, retries and timeouts](/blog/rate-limits-retries-timeouts-ai-reliability.html). The short version: set the deadline first, then fit retries inside it.

## A policy that holds up

**Classify errors.** Retry on network errors, timeouts, 429, 500, 502, 503, and the 529 "overloaded" status Anthropic uses. Never retry other 4xx errors. If the response carries a retry-after header, honor it over your own schedule.

**Use full jitter.** Sleep a random duration between zero and min(cap, base * 2^attempt). Randomness is what breaks up the synchronized wave. Two or three retries is usually enough. If a call hasn't worked after that, waiting longer rarely helps.

**Enforce a deadline, not just an attempt count.** Pass an overall time budget and stop when the next sleep would exceed it.

type Opts = { maxAttempts: number; baseMs: number; capMs: number; deadlineMs: number };

const RETRYABLE = new Set([408, 429, 500, 502, 503, 529]);

function isRetryable(err: any): boolean {
  if (err?.status) return RETRYABLE.has(err.status);
  return ["ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET"].includes(err?.code)
    || err?.name === "TimeoutError";
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  o: Opts
): Promise<T> {
  const start = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(AbortSignal.timeout(30_000));
    } catch (err: any) {
      const last = attempt + 1 >= o.maxAttempts;
      if (last || !isRetryable(err)) throw err;
      const hinted = Number(err?.headers?.["retry-after"]) * 1000;
      const jitter = Math.random() * Math.min(o.capMs, o.baseMs * 2 ** attempt);
      const delay = Number.isFinite(hinted) ? hinted : jitter;
      if (Date.now() - start + delay > o.deadlineMs) throw err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

**Add a circuit breaker.** Backoff protects one request. A breaker protects the system. Track failures per provider and model in a rolling window. When the failure rate crosses a threshold, say half of the last 20 calls, open the circuit and fail fast for 30 seconds. Then let a single probe request through. If it succeeds, close the circuit. If it fails, wait again. Libraries like opossum (Node) or pybreaker (Python) do this for you. Don't hand-roll it unless you enjoy debugging half-open states.

**Retry in exactly one layer.** Pick the layer closest to the provider, usually a thin wrapper, and turn off SDK-level retries elsewhere. Anthropic's SDK retries by default, so check that you aren't stacking your loop on top of its loop.

**Give open circuits somewhere to go.** A breaker without a fallback just turns slow errors into fast errors. [CV Matcher](/projects/cv-matcher.html) makes one Claude Haiku call per CV and job pair. If the call fails or the JSON doesn't parse, it falls back to a deterministic TF-IDF keyword score. BrightPath's tutor answers with a pre-written message when its model call fails. Neither fallback is clever. Both mean the user sees something instead of a spinner.

## Idempotency: the part people skip

Retrying a pure text-in, text-out call is safe. Retrying a call that triggers side effects is not. If the model's output sends an email, creates a ticket or charges a card, a timeout on the response doesn't tell you whether the work happened.

Don't assume the LLM API gives you an idempotency key. Put the guarantee in your own job layer. Give each unit of work a stable ID, such as a message ID or a hash of the input. Record the result under that ID before acting, and check for it before running again. Everyring.ai takes this approach for call-event webhooks: downstream syncs are claimed atomically in Postgres, so a redelivered webhook can't create a duplicate. The same pattern works for LLM jobs. For tool-calling flows, our piece on [reliable LLM tool use](/blog/reliable-external-tool-use-for-llms.html) goes deeper.

## Where this breaks

Retries can't fix a quota problem. If you are steadily over your tier's rate limit, backoff just spreads the failure out. You need a queue with a concurrency cap, or a higher tier.

Streaming complicates everything. If a stream dies after 400 tokens, retrying from scratch means the user sees the answer restart. For interactive UIs, buffer and retry before first token only, and surface a clear error after that.

Retries also hide problems. A call that succeeds on attempt three looks healthy in your dashboard. Log the attempt count and the error class on every call, or you'll never see the provider degrading until it fully fails. Plain logs aren't enough here, as we argued in [LLM observability](/blog/llm-observability-logs-arent-enough.html).

For a small team with one low-volume background job, a circuit breaker is probably overkill. Classified retries with jitter and a deadline get you most of the value.

## This week

Find every place your code calls a model. Count the retry layers between a user action and the provider, including SDK defaults. If the answer is more than one, remove all but one. Then add the error classifier and jitter from the snippet above, and log attempts per call.

If you'd rather have someone audit the whole pipeline, [Start a project](https://telaloom.com/contact.html) with us and we'll look at where yours is most likely to fall over.

<!-- RELATED_START -->

## Related articles

- [How to Manage LLM API Keys and Secrets in Production](https://telaloom.com/blog/manage-llm-api-keys-secrets-production.html)
- [Rate Limits, Retries, Timeouts: What Makes AI Actually Reliable](https://telaloom.com/blog/rate-limits-retries-timeouts-ai-reliability.html)
- [Function Calling Isn't Enough: Building Reliable LLM Tool Use](https://telaloom.com/blog/reliable-external-tool-use-for-llms.html)
- [LangChain vs Custom Code: When a Framework Is Worth It](https://telaloom.com/blog/langchain-llamaindex-vs-custom-code-ai-workflows.html)

<!-- RELATED_END -->
