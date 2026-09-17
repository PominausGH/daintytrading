---
title: "Your AI Feature Launch Was The Cheap Part"
description: "Model deprecations, prompt drift, and pricing shifts mean AI features keep costing money after launch — most quotes never account for it."
category: "Business"
publishedDate: "2026-08-28"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.png"
---

<p>The invoice for an AI feature doesn't end at launch. It ends when the vendor deprecates the model you built on, when a silent system prompt change on their end shifts your outputs, or when a pricing update quietly doubles your inference bill. Most project quotes treat AI features like any other software feature: fixed scope, fixed price, ship it, done. That assumption is wrong, and it's the single biggest source of budget surprises we see in AI work.</p>

<p>Traditional software doesn't rot this way. A REST endpoint you wrote in 2022 still behaves the same way today unless you touch it. An AI feature is different because a third party — Anthropic, OpenAI, whoever — owns the component doing the actual reasoning, and they change it out from under you on their schedule, not yours.</p>

<h2>The wrong approach: quote it like a normal feature</h2>

<p>The common pattern looks like this: a team scopes an AI feature the same way they'd scope a CRUD form. They estimate the build, add a buffer for testing, quote a fixed price, and move on to the next project once it ships. The prompt gets hard-coded, the model name gets hard-coded, and nobody puts a line item on the invoice for "what happens when Anthropic deprecates this model in fourteen months."

It seems reasonable because the feature works on launch day and for months afterward. Then a model gets deprecated, or a provider updates a model in place and outputs subtly shift — a classifier that used to return clean JSON starts wrapping it in prose, a summarizer starts hedging more. Nobody notices until a customer complains, and now it's an emergency fix instead of planned maintenance. The team that built it has moved on. The team fixing it is starting from zero context, at a worse hourly rate than if it had been planned.</p>

<h2>The better approach: budget maintenance as a separate line item</h2>

<p>We treat AI features as having two costs: the build, and the keep-it-working. The keep-it-working cost is smaller per month but it's not zero, and it doesn't stop.

Concretely, that means a few things. First, pin model versions explicitly rather than pointing at a "latest" alias — you want deprecations to hit you as a scheduled decision, not a surprise 3am failure. Second, put a lightweight eval suite behind every AI feature: a few dozen real input/output pairs you can re-run against a new model version before you switch, so "does this still work" is a five-minute check instead of a guessing game. On <strong>Email Triage</strong>, that eval suite is what let us swap underlying models twice without a customer noticing. Third, route calls through a thin gateway instead of hard-coding provider SDK calls directly into business logic — LiteLLM or a custom wrapper, doesn't matter much which, as long as swapping providers or models is a config change and not a refactor.

Pricing is the other half. Providers change per-token pricing, introduce new tiers, or deprecate cheaper models in favor of pricier defaults. On <strong>CV Matcher</strong> and <strong>BrightPath</strong>, we track cost-per-request as a monitored metric, the same way you'd monitor latency, because a provider price change can turn a profitable feature into a loss leader without a single line of your code changing. We budget a quarterly review — a couple of hours checking model deprecation notices, re-running evals, and checking whether a newer model is now cheaper and better than what's in production. That's the real maintenance cost: not a big number, but a recurring one, and it needs to live in the contract, not get discovered later.</p>

<h2>Where this breaks</h2>

<p>For a genuinely small, low-stakes feature — an internal tool three people use, a nice-to-have that nobody depends on — this much process is overkill. Building an eval suite and a gateway abstraction for a Slack bot that summarizes standup notes costs more than just fixing it manually twice a year when it breaks. The honest answer is that maintenance investment should scale with how much the business depends on the feature working correctly. <strong>Ghost Writer</strong> and <strong>AutoArchive Mail</strong> get different levels of rigor for exactly this reason — one touches customer-facing output, the other doesn't.

The other place this breaks: if you're on a fixed-bid contract with no maintenance retainer, you genuinely can't afford to do any of this, and pretending otherwise just burns your margin. Say so up front instead of quietly eating the cost.</p>

<h2>What to do this week</h2>

<p>If you have an AI feature in production right now, go find out what model it's calling and whether that model has a deprecation date. Providers publish these — check them. If you don't have an eval set for that feature, write down ten real inputs and their expected outputs today; that's the seed of a suite that will save you hours the next time a model changes. And if you're scoping new AI work, put maintenance on the table as its own line item before you quote a price, not after something breaks. If you want a second opinion on what that ongoing cost should look like for your feature, <a href="https://telaloom.com/contact.html">start a project</a> with us and we'll walk through it.</p>
