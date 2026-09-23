---
title: "Self-Hosting LiteLLM: What We Learned (and Why Our Products Call Providers Directly)"
description: "We self-hosted LiteLLM for internal tools while our products called providers directly. Here's when a gateway earns its place, and the backup lesson we learned the hard way."
category: "AI · Engineering"
publishedDate: "2026-06-08"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

<p>Should you put a self-hosted LLM gateway like LiteLLM in front of everything? Our honest answer after running one: not by default. We self-hosted LiteLLM, alongside Open WebUI, for our internal tools — one OpenAI-compatible endpoint in front of several providers, with model deployments stored in the gateway's own database. Our customer-facing products, meanwhile, call their providers directly through a thin wrapper in each codebase. When the gateway's stored configuration eventually became unusable and we shut it down, nothing a customer touches broke. That outcome shaped how we now think about gateways: useful infrastructure, but not something your product should be unable to live without.</p>

<h2>The common wrong approach</h2>

<p>There are two ways to get this wrong, and they sit at opposite ends.</p>

<p>The first is the one most tutorials warn about: provider calls scattered across the codebase. Every service imports its own SDK, hard-codes a model name, and grows its own retry logic. Adding a second provider turns into <code>if/else</code> branches around a <code>provider_name</code> variable, and switching models means touching every call site.</p>

<p>The second is the overcorrection: making a self-hosted gateway the single point every request must pass through before you have the reasons to need one. It feels like good architecture — one endpoint, central logging, provider failover in a config file. But you've added a stateful service to the critical path of every AI feature, and its configuration, keys and database are now as important as your application's own. If the gateway goes down or its config is lost, every product behind it goes down with it.</p>

<h2>The better approach</h2>

<p>Start with the thin wrapper, and add a gateway when the problem actually appears.</p>

<p>Our products call their providers directly rather than through a shared gateway. <a href="/projects/emailtriage.html">Email Triage</a> and <a href="/projects/cv-matcher.html">CV Matcher</a> call the Anthropic SDK directly; <a href="/projects/brightpath.html">BrightPath</a> calls OpenRouter, with the provider switchable by one environment variable. The goal is one small module per app where timeouts, retries and fallbacks live, keeping the model choice out of business logic. For a single product talking to one or two providers, that's most of what a gateway gives you, with nothing extra to run.</p>

<p>A gateway earns its place when several services share providers: many internal tools, a chat UI, and scripts all wanting the same keys, spend visibility and failover. That was our internal-tools situation, and it is what LiteLLM is built for — an OpenAI-compatible API that let any tool point at one URL, with models added or swapped without touching the tools themselves.</p>

<p>If you do run one, three rules:</p>
<ul>
<li><strong>Keep a direct-call path.</strong> Anything customer-facing should be able to talk to its provider without the gateway, even if the gateway is the normal route. That's what made our shutdown a non-event.</li>
<li><strong>Treat the gateway's config as production data.</strong> If model deployments live in its database rather than in a version-controlled file, back that database up like any other.</li>
<li><strong>Back up the encryption key with the database.</strong> Gateways that store provider credentials in their database encrypt them with a key or salt set in the environment. Lose or change that value and the stored deployments can't be decrypted — the gateway starts, but has no usable routes. Store the key somewhere that survives a rebuild, and test a restore.</li>
</ul>

<h2>Where this breaks</h2>

<p>The thin-wrapper approach has real limits. With no central gateway, cost reporting is per product, not in one place, and cross-provider failover is something each wrapper has to implement for itself. If you run many services against several providers and need central spend caps or audit logging, a gateway like LiteLLM — or a managed option like OpenRouter — is the right call, and the operational cost is worth paying. The mistake isn't running a gateway; it's running one without the backups and fallbacks that stop it becoming the thing that takes everything down.</p>

<p>There's also a tooling limit: a gateway is not an observability or quality platform. It can log requests and estimate cost, but it won't tell you whether outputs are any good. That still needs evals and quality checks in the application.</p>

<h2>Practical next step</h2>

<p>List every place your code calls an LLM provider. If a customer-facing feature can only reach its model through a self-hosted gateway, add a direct fallback path this week. If you store model configuration in a gateway database, check today that both the database and its encryption key are in your backups — and restore them somewhere once to prove it. If you want help deciding whether you need a gateway at all, that's part of our <a href="/services/ai-infrastructure.html">AI infrastructure</a> work — <a href="https://telaloom.com/contact.html">start a project</a> and we'll look at your setup.</p>

<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you're looking to ship something like what's described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
