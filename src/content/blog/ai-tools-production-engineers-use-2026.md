---
title: "The AI Stack We Actually Run in Production (2026)"
description: "No gateway zoo, no vector database by default. The unglamorous AI stack TelaLoom actually runs in production in 2026 — and when the heavier tools are worth adding."
category: "AI · Engineering"
publishedDate: "2026-07-15"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.png"
---

<p>What AI tooling does a small studio actually run in production in 2026? Less than the vendor landing pages would have you believe. Across our own products, the stack is deliberately boring: provider SDKs called directly through one small wrapper per app, quality gates written as plain code, Postgres for almost everything, Redis for queues, and Docker Compose on a single VPS. No prompt-management SaaS, no tracing platform, no managed vector database. That isn't a purity stance — it's what survived contact with real products, and it's what we'd recommend to most teams starting out.</p>

<h2>The common wrong approach</h2>

<p>The default move is to assemble the stack before the product exists. A team reads a "modern AI stack" post, signs up for a prompt gateway, a tracing platform, an eval SaaS and a vector database, and wires all four in before the first user has touched the feature. Each tool is good at what it does. The problem is that each one is another dashboard, another bill, another API key, another thing that can go down — and none of them tells you whether the feature is any good.</p>

<p>The opposite failure is just as common: hard-coding a provider call into ten different places in the codebase, with the model name as a string literal each time. That feels fast, until you need to change models, add a retry, or cap spend, and discover you're editing ten files.</p>

<h2>What we actually run</h2>

<p><strong>1. Provider SDKs behind one thin wrapper per app.</strong> <a href="/projects/emailtriage.html">Email Triage</a> and <a href="/projects/cv-matcher.html">CV Matcher</a> call the Anthropic SDK directly with Claude Haiku 4.5. <a href="/projects/brightpath.html">BrightPath</a> calls OpenRouter, with Gemini Flash as the default for its Pax tutor, and the provider is switchable by one environment variable. <a href="/projects/ghost-writer.html">Ghost Writer</a> drafts with Claude and falls back to Gemini if Claude is unavailable. In every case the model call should live behind one small module, so timeouts, retries and model changes happen in one place.</p>

<p><strong>2. Quality gates as code, not a platform.</strong> Ghost Writer doesn't publish anything that hasn't passed a fact-checker, a quality checker and an editor-critique pass. Email Triage keeps its production prompts in one registry with a version date and a SHA-256 fingerprint, and publishes those prompts on a public transparency page. That gives us reviewable diffs every time a prompt changes — which is most of what people buy a prompt-management tool for.</p>

<p><strong>3. Deterministic fallbacks.</strong> Every AI step should have a non-AI answer for when the model call fails. CV Matcher falls back to a TF-IDF keyword score. BrightPath's Pax tutor answers with a pre-written, subject-aware fallback instead of an error. The fallback is rarely as good as the model, but it's always better than a spinner or a stack trace.</p>

<p><strong>4. Postgres, and pgvector only where retrieval is real.</strong> Most of our products have no embeddings at all, because they don't need them. Where retrieval is genuinely part of the product — <a href="/projects/convoforge.html">ConvoForge</a> is the example — it's Postgres with pgvector, next to the rest of the data, not a separate vector service to keep in sync.</p>

<p><strong>5. Redis job queues and boring observability.</strong> Background work — syncing inboxes, processing jobs — runs on Bull/BullMQ over Redis, so a slow provider call never blocks a web request. Errors go to Sentry, traffic goes to self-hosted Umami, and everything runs as containers under Docker Compose on one VPS.</p>

<h2>Where this breaks</h2>

<p>This stack is sized for a studio running many small products, not for one product at very high scale. The heavier tools exist for real reasons. A gateway like Helicone, LiteLLM or Portkey earns its place once several services share providers and you need central caching, spend caps and failover. A tracing platform like LangSmith or Arize is worth it once you're running long agent chains where "which step went wrong" isn't obvious from the logs. A managed vector database like Pinecone makes sense when you have tens of millions of vectors or heavy filtered queries that pgvector can't keep fast. None of those describe our products today — but they might describe yours.</p>

<p>The other honest limit: quality gates written as code only catch what you thought to check for. They are not a substitute for a real eval set built from real inputs, and if your feature makes decisions users depend on, you want both.</p>

<h2>Your next step this week</h2>

<p>Search your codebase for every direct LLM call. If the model name appears in more than one place, pull it into a single module with a timeout, one retry and a fallback answer — that one change gets you most of what a gateway would, for an afternoon's work. Then write down, for each AI feature, what the user sees when the model call fails. If the answer is "an error," that's your first fix. If you'd like help deciding which of the heavier tools your system actually needs, our <a href="/services/ai-infrastructure.html">AI infrastructure</a> work is exactly that conversation — <a href="https://telaloom.com/contact.html">start a project</a> and we'll look at what you've got.</p>
