---
title: "What Breaks First When You Put an LLM in Production"
description: "Rate limits, silent format drift, and untested timeouts are what actually take down LLM pipelines — not the failure modes teams demo for."
category: "AI · Infrastructure"
publishedDate: "2026-08-28"
readTime: "4 min"
ogImage: "https://daintytrading.com/og-card.png"
---

<p>The first thing to break in a production LLM pipeline is never the model's reasoning. It's the plumbing around it. Rate limits hit under real concurrency, not the ten requests you tested with. A prompt that returned clean JSON for three weeks suddenly returns a sentence of caveats before the JSON, because the model was updated upstream and nobody told you. A request hangs for 40 seconds instead of 4, and the timeout you copy-pasted from a tutorial kills it before the retry logic even wakes up. None of this shows up in a demo. All of it shows up in week two of real traffic.</p>

<h2>The common wrong approach</h2>
<p>Most teams ship the happy path first, because the happy path is what gets a feature approved. A single call to the provider's SDK, a try/catch around it, a default timeout, and a prompt that says "respond only in JSON." It works in staging. It works for the first hundred users. Then traffic clusters — a marketing email goes out, a batch job kicks off at 9am, three customers hit "generate" at the same time — and the pipeline starts throwing 429s it was never built to expect.</p>
<p>The format drift is worse because it's quiet. Nobody gets paged when a model starts wrapping its JSON in a markdown code fence, or adds a trailing "Let me know if you'd like changes!" after the object. The pipeline doesn't crash — it just starts failing to parse a rising percentage of responses, and by the time someone notices, there's a backlog of malformed records sitting in a queue or, worse, half-written to a database. We saw this exact failure on an early version of <strong>Email Triage</strong>: a model update changed how it formatted category labels, and the classifier silently misfiled a week of email before anyone checked the logs.</p>

<h2>The better approach</h2>
<p>Treat the model call like any other unreliable network dependency, because that's what it is. Three things matter more than picking the "best" model.</p>
<p>First, put a gateway or router in front of the raw API — something like LiteLLM, OpenRouter, or a thin internal wrapper — so retries, backoff, and provider fallback live in one place instead of scattered across every call site. When Anthropic or OpenAI rate-limits you, you want exponential backoff with jitter and a queue, not a stack trace in production. On <strong>AutoArchive Mail</strong>, we route through a queue with a concurrency cap tuned below the account's actual rate limit — it's slower under burst load, but it never falls over.</p>
<p>Second, stop trusting the model to self-report its output format. Use structured outputs or tool-calling schemas wherever the provider supports them — Anthropic's tool use and forced JSON schemas exist precisely so you're not parsing prose. Where that's not available, validate every response against a schema (Pydantic, Zod, whatever your stack uses) before it touches downstream logic, and treat a validation failure as a retryable error, not a silent skip. We built this into <strong>CV Matcher</strong> after watching a free-text extraction step quietly drop fields whenever a resume had unusual formatting — schema validation turned a silent data-loss bug into a visible, retried failure.</p>
<p>Third, set timeouts based on the actual p99 latency of the model and task you're using, not a generic default. A single classification call and a long document summarization call have wildly different tail latencies — measure them separately, and give slow-path calls a longer timeout plus a background/async execution path instead of holding an HTTP connection open and hoping.</p>

<h2>Where this breaks</h2>
<p>None of this is free. A gateway adds a service to operate and a place for bugs to hide. Schema validation adds latency and a new class of "technically valid but semantically wrong" failures you now have to catch separately. For a two-person team shipping an MVP with low volume, a raw SDK call with a simple retry loop is genuinely fine — you don't need queueing infrastructure for a feature that gets used twice a day. The mistake isn't skipping this on day one. It's not having a plan for when volume changes, and finding out the plumbing doesn't scale at the same moment your first real customer does.</p>

<h2>Practical next step</h2>
<p>This week, pull the last 500 LLM responses your pipeline actually received in production — not your test fixtures — and run them through your parser. Count how many would have failed silently versus loudly. If you can't easily get that list, that's the actual problem: you're not logging raw model output, which means you can't tell format drift from a real bug when it happens. If you want a second set of eyes on where your pipeline is most likely to break under real load, <a href="https://daintytrading.com/contact.html">start a project</a> with us.</p>
