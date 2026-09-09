---
title: "LLM Routing: Why We Run Claude, Gemini, and OpenAI Behind One Gateway"
description: "Hard-coding a single model provider into your app is a liability. Here's how we route across Claude, Gemini, and OpenAI — and the rules we use to decide which model runs which task."
category: "AI · Infrastructure"
publishedDate: "2026-05-06"
readTime: "7 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

<h2>The problem with a single provider</h2>
<p>Most AI applications start the same way: pick a model, hard-code the API call, ship it. That works fine until the model you chose gets deprecated, its price doubles, a competitor releases something significantly better, or it goes down at the worst possible moment. Any of these events requires a code change across every place you called the API directly.</p>
<p>We learned this lesson early and now every product we build — whether for our own portfolio or for clients — routes LLM calls through a single gateway. The application code sees one endpoint. The gateway decides which provider gets the request.</p>

<h2>How the gateway works</h2>
<p>We self-host <a href="https://litellm.ai" rel="noopener" target="_blank">LiteLLM</a> as the primary gateway. It presents an OpenAI-compatible API so the application code never changes — you call <code>POST /chat/completions</code> with a model name, and LiteLLM translates that into the right provider API call.</p>
<p>For products that need access to models outside LiteLLM’s direct integrations, or where we want managed fallback and routing, we add <a href="https://openrouter.ai" rel="noopener" target="_blank">OpenRouter</a> as a second layer. This is the setup behind <a href="/projects/brightpath.html">BrightPath</a>, where different lesson types use different models depending on the required reasoning depth and cost envelope.</p>
<p>The gateway gives us:</p>
<ul>
<li><strong>Request logging.</strong> Every call, latency, token count, and cost is recorded. This is how we catch a prompt change that accidentally doubled token usage.</li>
<li><strong>Rate limit handling.</strong> The gateway retries on 429s and switches providers on hard limits. The application sees a result, not an error.</li>
<li><strong>Cost tracking per project.</strong> We tag requests with a project ID and generate weekly cost reports. Without this, costs drift invisibly.</li>
<li><strong>Zero-downtime model upgrades.</strong> When Anthropic released Claude 3.5 Sonnet, we changed one config value. No deploys, no PR reviews, no regression testing of API call sites.</li>
</ul>

<h2>Our model routing rules</h2>
<p>Not all tasks need the same model. We route based on three criteria: reasoning requirement, latency tolerance, and cost per call.</p>

<h3>Claude Sonnet — reasoning and long context</h3>
<p>We default to Claude for tasks that require sustained reasoning, careful instruction following, or long context windows. This includes: writing first drafts from complex briefs, tutoring conversations in BrightPath, contract and document analysis, and any task where a wrong output has meaningful downstream consequences.</p>
<p>Claude is our most expensive default, but the quality floor is higher than the alternatives on tasks where the prompt is complicated and the output needs to be consistent.</p>

<h3>Gemini Flash — high-volume, fast, cheap</h3>
<p>For high-throughput tasks where latency matters and cost compounds fast — real-time classification, suggestion generation, short completions — Gemini Flash is usually the right call. It’s significantly cheaper per token than Claude Sonnet and fast enough for interactive use. BrightPath uses it for inline hint generation during lessons: needs to be instant, doesn’t need to be brilliant.</p>

<h3>GPT-4o — when client infrastructure requires it</h3>
<p>We occasionally default to GPT-4o on client engagements where the client already has Azure OpenAI credits, enterprise agreements, or compliance requirements that tie them to Microsoft infrastructure. The gateway makes this a config change, not a rebuild.</p>

<h2>When to introduce routing</h2>
<p>You don’t need a gateway on day one. If you have one model doing one task, a direct API call is fine. Introduce a gateway when:</p>
<ul>
<li>You have more than two distinct AI workflows with different requirements</li>
<li>You’re spending more than $500/month on model API calls</li>
<li>You need request logging for debugging or compliance</li>
<li>You want to experiment with model switching without code changes</li>
</ul>
<p>Setting up LiteLLM takes about a day. We include it as standard in our <a href="/services.html">AI infrastructure engagements</a>.</p>

<h2>One thing people get wrong</h2>
<p>Teams often try to pick “the best model” once and use it everywhere. There is no best model — there is the right model for a given task at a given cost point. The goal of a routing layer is to match tasks to models correctly, not to standardise on a single provider out of preference or familiarity.</p>
<p>If you’re running the same frontier model for both a 10,000-token document analysis and a two-sentence category label, you’re probably overpaying on one and correctly spending on the other.</p>


<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you’re looking to ship something like what’s described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
