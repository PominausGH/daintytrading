---
title: "The unglamorous ops work behind production AI"
description: "What happens after the AI demo: managing P99 latency, sanitizing PII from prompt logs, and handling malformed JSON failures in production."
category: "AI · Engineering"
publishedDate: "2026-06-10"
readTime: "5 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

<p>The operational work behind a production AI feature isn't prompt engineering—it's managing unpredictable latency, sanitizing PII from your logs, and gracefully handling structural failures when the model inevitably hallucinates malformed JSON. A reliable production AI agent takes months from proof of concept to stable deployment. The demo takes a weekend. The gap is filled with the unglamorous ops work required to keep the system alive when real, unpredictable users start interacting with it. If you're reading this, you probably already know that shipping an LLM feature isn't like shipping a standard CRUD application. The database returns in 15ms. The LLM might take 400ms, or it might take 14 seconds, or it might return a 529 overloaded error. The conversation around AI operations is often hijacked by vendors selling complex observability platforms. You don't need a massive new platform. You need a few specific, boring engineering practices.</p>

<h2>The common wrong approach</h2>
<p>Most teams launch their first AI feature with standard web application monitoring. They track HTTP error rates and average latency. When it comes to logging, they dump the raw prompt and the raw completion directly into Datadog, Splunk, or CloudWatch to figure out what the model is doing. They assume that if they ask the API for JSON, they will get JSON back.</p>

<p>This breaks immediately in production. First, average latency is a completely useless metric for LLMs. If 90% of your requests take 2 seconds, but 10% take 25 seconds because of token generation spikes, your average looks fine while 10% of your users are staring at a broken spinner and abandoning the app. Second, dumping raw prompts into centralized logging is a massive security risk. Users will paste social security numbers, API keys, and internal company strategy into your text boxes. If that hits your raw logs, you've just created a compliance nightmare.</p>

<p>Finally, assuming structured output works perfectly is a trap. You ask the model for an array of user objects. It returns a string that says, "Here is your JSON:" followed by a Markdown code block, followed by "Hope that helps!" Your standard <code>JSON.parse()</code> blows up, the backend throws a 500, and the user gets a generic error.</p>

<h2>The better approach</h2>
<p>At Dainty Trading, when we build client systems like CV Matcher or BrightPath, we treat the LLM as a hostile, unreliable, slow third-party API. Here is what that actually looks like in practice.</p>

<p><strong>Monitor P99s, not averages.</strong> Set up alerts specifically for P95 and P99 latency. We configure hard timeouts on our gateway layer. If the model doesn't respond in 8 seconds, we kill the connection and fall back. We'd rather show the user a fast error or a cached response than hang their session indefinitely while a model struggles to generate tokens.</p>

<p><strong>Sanitize logs at the gateway.</strong> You need to log prompts to debug failures, but you cannot log PII. We use a lightweight local model or aggressive regex rules at the application edge to redact PII before the prompt ever hits our logging infrastructure. We log the system prompt, the token counts, and the latency, but the user's raw input is stripped of sensitive entities. We only keep the full payloads in short-lived, encrypted, compliance-audited storage for immediate debugging, and purge them within 7 days.</p>

<p><strong>Implement defensive parsing and fallbacks.</strong> Never trust the LLM's structure. We use Zod in TypeScript or Pydantic in Python to strictly validate every response. But we don't just fail on validation errors. We write defensive extraction logic that strips Markdown formatting and attempts to salvage partial JSON structures. If the parsing completely fails, we have a fallback strategy: either retry the request with a lower temperature, or degrade gracefully to a non-AI feature. If you want us to help you <a href="https://daintytrading.com/contact.html">start a project</a>, getting these defensive layers right is where we spend the bulk of our integration time.</p>

<h2>Where this breaks</h2>
<p>This defensive posture isn't free. Running PII redaction on every incoming prompt adds latency—usually 50 to 100ms if done locally—and increases your baseline compute costs. If you are building a low-margin consumer tool at scale, that overhead might break your unit economics.</p>

<p>Strict structural validation can also become a significant maintenance burden. When you use tools like Zod to validate LLM outputs, you will find yourself constantly tweaking the schemas because the model will invent new, creative ways to format its answers. You have to balance strictness with flexibility. If your schema is too rigid, you will throw away perfectly good answers just because the model added an unexpected, harmless key to the JSON object. You end up writing a lot of custom sanitization code just to keep the pipeline moving.</p>

<h2>Practical next step</h2>
<p>Don't try to implement all of this today. Start with the most critical risk: PII leaking into your logs. Check your CloudWatch, Datadog, or whatever tool you use for application logging. Search for the raw payloads being sent to your LLM provider. If user input is sitting there in plain text, write a simple middleware function this week to hash or redact the user message before it gets logged. Once your logs are clean and your compliance team is happy, you can start worrying about parsing errors and your P99 latency. Fix the security hole first, then fix the reliability.</p>

<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you're looking to ship something like what's described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
