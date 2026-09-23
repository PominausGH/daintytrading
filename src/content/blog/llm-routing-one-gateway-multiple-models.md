---
title: "LLM Routing: When to Put Claude, Gemini, and OpenAI Behind One Gateway"
description: "Hard-coding a single model provider into your app is a liability. Here's how to route across Claude, Gemini, and OpenAI — and the rules for deciding which model runs which task."
category: "AI · Infrastructure"
publishedDate: "2026-05-06"
readTime: "7 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

<h2>The problem with a single provider</h2>
<p>Most AI applications start the same way: pick a model, hard-code the API call, ship it. That works fine until the model you chose gets deprecated, its price doubles, a competitor releases something significantly better, or it goes down at the worst possible moment. Any of these events requires a code change across every place you called the API directly.</p>
<p>The fix is to keep the model choice out of application code. In our own products that means one thin wrapper per app with the model name in one place; once several services share providers, a gateway is the next step. With a gateway, the application code sees one endpoint and the gateway decides which provider gets the request.</p>

<h2>How the gateway works</h2>
<p>We've self-hosted <a href="https://litellm.ai" rel="noopener" target="_blank">LiteLLM</a> for internal tools, and it's our default recommendation for a gateway. It presents an OpenAI-compatible API so the application code never changes — you call <code>POST /chat/completions</code> with a model name, and LiteLLM translates that into the right provider API call.</p>
<p><a href="https://openrouter.ai" rel="noopener" target="_blank">OpenRouter</a> is the managed alternative — one API key, many providers, with fallback handled for you. <a href="/projects/brightpath.html">BrightPath</a> calls OpenRouter directly, with Gemini Flash as the default for Pax, Writing Coach and weekly parent reports; the provider is one environment variable, with direct Claude, OpenAI and MiniMax paths as alternates.</p>
<p>A gateway gives you:</p>
<ul>
<li><strong>Request logging.</strong> Every call, latency, token count, and cost is recorded. This is how you catch a prompt change that accidentally doubled token usage.</li>
<li><strong>Rate limit handling.</strong> The gateway retries on 429s and switches providers on hard limits. The application sees a result, not an error.</li>
<li><strong>Cost tracking per project.</strong> Tag requests with a project ID and generate weekly cost reports. Without this, costs drift invisibly.</li>
<li><strong>Zero-downtime model upgrades.</strong> When a better model ships, you change one config value instead of hunting through API call sites.</li>
</ul>

<h2>Our model routing rules</h2>
<p>Not all tasks need the same model. Route based on three criteria: reasoning requirement, latency tolerance, and cost per call.</p>

<h3>Claude Sonnet — reasoning and long context</h3>
<p>We default to Claude for tasks that require sustained reasoning, careful instruction following, or long context windows. This includes: writing first drafts from complex briefs, contract and document analysis, and any task where a wrong output has meaningful downstream consequences.</p>
<p>Claude is our most expensive default, but the quality floor is higher than the alternatives on tasks where the prompt is complicated and the output needs to be consistent.</p>

<h3>Gemini Flash — high-volume, fast, cheap</h3>
<p>For high-throughput tasks where latency matters and cost compounds fast — real-time classification, suggestion generation, short completions — Gemini Flash is usually the right call. It’s significantly cheaper per token than Claude Sonnet and fast enough for interactive use. BrightPath uses it for Pax, its in-lesson tutor: it needs to be fast and cheap at volume.</p>

<h3>GPT-4o — when client infrastructure requires it</h3>
<p>GPT-4o is the sensible default on client engagements where the client already has Azure OpenAI credits, enterprise agreements, or compliance requirements that tie them to Microsoft infrastructure. The gateway makes this a config change, not a rebuild.</p>

<h2>When to introduce routing</h2>
<p>You don’t need a gateway on day one. If you have one model doing one task, a direct API call is fine. Introduce a gateway when:</p>
<ul>
<li>You have more than two distinct AI workflows with different requirements</li>
<li>You’re spending more than $500/month on model API calls</li>
<li>You need request logging for debugging or compliance</li>
<li>You want to experiment with model switching without code changes</li>
</ul>
<p>Setting up LiteLLM takes about a day, and we stand it up in our <a href="/services.html">AI infrastructure engagements</a> when a client runs several AI workflows.</p>

<h2>One thing people get wrong</h2>
<p>Teams often try to pick “the best model” once and use it everywhere. There is no best model — there is the right model for a given task at a given cost point. The goal of a routing layer is to match tasks to models correctly, not to standardise on a single provider out of preference or familiarity.</p>
<p>If you’re running the same frontier model for both a 10,000-token document analysis and a two-sentence category label, you’re probably overpaying on one and correctly spending on the other.</p>


<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you’re looking to ship something like what’s described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
