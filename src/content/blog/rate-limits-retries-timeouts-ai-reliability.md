---
title: "Rate Limits, Retries, Timeouts: What Makes AI Actually Reliable"
description: "A better model doesn't fix a flaky AI integration. Backoff, idempotency, and graceful degradation do — here's how we build them."
category: "AI · Infrastructure"
publishedDate: "2026-08-28"
readTime: "5 min"
ogImage: "https://daintytrading.com/og-card.png"
---

<p>Your AI feature works perfectly in the demo. Three weeks after launch, it's failing for 2% of users at random, support tickets are piling up, and nobody can reproduce the bug. That's not a model problem. It's a 429 you didn't handle, a request that hung for 90 seconds and got retried into a duplicate charge, or a timeout that took down an unrelated part of your app with it. The gap between a flaky AI integration and a reliable one is almost never the model. It's whether you built the boring plumbing around it.</p>

<p>We've shipped enough production AI features — Email Triage, AutoArchive Mail, CV Matcher — to know that model choice gets 90% of the design discussion and causes maybe 10% of the incidents. The other 90% of incidents come from treating an LLM API call like a normal function call: assume it succeeds, assume it's fast, assume calling it twice is harmless.</p>

<h2>The common wrong approach</h2>

<p>Most teams start with a direct call to the provider SDK, wrapped in a try/catch that logs the error and shows the user a generic "something went wrong" message. It seems reasonable — you're shipping fast, the happy path works, and rate limits feel like an edge case you'll deal with later.</p>

<p>Then traffic grows. You start hitting 429s during peak hours. Someone adds a naive retry loop: catch the error, wait one second, try again, up to three times. This works until it doesn't — a burst of 429s across concurrent requests all retry at the same one-second interval, which just recreates the burst that caused the rate limit in the first place. Meanwhile, a request that times out after 30 seconds gets retried, but the original request wasn't actually dead — it completes server-side a moment later, and now you've sent the email twice, charged the card twice, or written the summary to the database twice. The failure mode isn't "the API is down." It's "the API is slow or briefly overloaded, and our retry logic amplified that into a worse problem."</p>

<h2>The better approach</h2>

<p>Three things fix most of this, in order of impact.</p>

<p><strong>Exponential backoff with jitter, not fixed intervals.</strong> When you get a 429 or a 5xx, wait an increasing amount of time before retrying — and randomize it. A concurrency of ten requests retrying at exactly the same interval just synchronizes the next failure. Jitter breaks that up. Anthropic's Python and TypeScript SDKs already do this by default with a configurable `maxRetries`, and it respects `retry-after` headers when the API sends them — check before you write your own, because most hand-rolled retry logic is worse than what's built in.</p>

<p><strong>Idempotency keys on anything that has a side effect.</strong> If a retried request could send an email, write a record, or trigger a downstream action, generate a unique key per logical operation (not per HTTP attempt) and check it before executing. In Ghost Writer, every draft generation is keyed to a request ID stored before the API call goes out — if the call times out and we retry, we check whether that ID already produced output before writing anything new. This is a few lines of code and it eliminates an entire category of "why did the user get this twice" tickets.</p>

<p><strong>Timeouts that are shorter than your patience, and a fallback for when they fire.</strong> Set an explicit timeout well under whatever your infrastructure's own limit is — if your load balancer kills connections at 60 seconds, don't let your LLM call run for 55 and leave no room to respond gracefully. When a timeout fires, don't just fail — degrade. Serve a cached response, fall back to a smaller/faster model, or queue the request and notify the user asynchronously instead of blocking. BrightPath does this for its summarization step: if the primary model call doesn't return in time, it falls back to a shorter-context, faster model rather than showing the user an error. Slightly worse output beats no output.</p>

<h2>Where this breaks</h2>

<p>This is real engineering effort, and for a low-traffic internal tool or a weekend prototype, it's probably overkill — a simple try/catch and a manual "try again" button will serve you fine. The complexity is worth it once you have real users depending on the feature working, not before. Idempotency in particular is easy to get wrong: if your key generation logic has a bug, you can silently swallow legitimate duplicate requests (two different users who happen to submit identical input) or fail to catch real duplicates because the key wasn't scoped tightly enough. Test this deliberately — don't assume it works because it compiled. And graceful degradation has a ceiling: if your fallback model produces meaningfully worse output, users notice, and "reliable but worse" isn't always better than "occasionally down."

</p>

<h2>Practical next step</h2>

<p>Pull up your current AI integration and check three things this week: does your retry logic use backoff with jitter (or are you relying on the SDK default, which you should verify is actually enabled)? Do any of your AI-triggered actions have side effects without an idempotency check? And what happens to the user right now when a call times out — do they see an error, or does something reasonable happen instead? If you're not sure how to answer these for your own system, or want a second set of eyes on it, <a href="https://daintytrading.com/contact.html">start a project</a> with us and we'll look at it together.</p>
