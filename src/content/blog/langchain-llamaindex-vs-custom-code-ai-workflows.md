---
title: "LangChain vs Custom Code: When a Framework Is Worth It"
description: "Use LangChain or LlamaIndex to prototype and for genuinely graph-shaped agents. For fixed pipelines in production, plain code is usually easier to run and debug."
category: "Automation"
publishedDate: "2026-10-17"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

Use an orchestration framework like LangChain or LlamaIndex when you're exploring, or when your workflow is a real stateful graph with branching, retries and tool loops. Use plain Python or Go when the workflow is a known sequence of steps. Most production AI features are the second kind. A framework there buys you little and costs you control.

The trouble is that the decision usually gets made in week one, during the prototype. The framework makes the demo fast, so it stays. Six months later nobody on the team can say exactly what prompt the model received.

## The common wrong approach

A team needs a feature that calls a model, maybe pulls in some documents, and returns structured output. They pick up a framework because it has a chain for each step. The demo works in an afternoon.

Then production happens. A user reports a bad answer, and you need the exact final prompt. In a framework, that prompt may be assembled across several layers: a template, a memory object, a retriever wrapper, an output parser. To see it, you step through library code, not your own.

Upgrades are the second cost. These ecosystems move fast, and their APIs have changed shape more than once. Pin versions and you fall behind. Don't pin and a minor bump changes behaviour. Either way, you are maintaining someone else's abstractions on top of a provider API that is already simple.

The third cost is the one people notice last. The framework's defaults become your behaviour. Default retries, default truncation, default parsing. If you didn't choose them, you don't know them. If you don't know them, you can't reason about a failure at 2am.

## The better approach

Start with a thin wrapper around the provider SDK. Write the prompt as a string you can print. Parse the output yourself. For most features this is under a couple hundred lines, and every line is yours.

That is how we build our own products. [CV Matcher](/projects/cv-matcher.html) makes one Claude Haiku call per CV and job pair. The call must return fixed JSON: a score, matched skills, missing skills and a short reason. Inputs are truncated to a fixed budget. If the call fails or the output doesn't parse, it falls back to a deterministic TF-IDF keyword score. Email Triage works the same way. It calls Claude Haiku directly through the Anthropic SDK, and every prompt sits in one registry with a version date and fingerprint. None of that needed a framework. It needed a function, a schema check and a fallback.

The rule of thumb: if you can draw your workflow as a straight line with a couple of fallbacks, write it as code. A framework adds nothing a function call doesn't already do.

Frameworks earn their place in three situations:

- **Prototyping.** You don't yet know the shape of the problem. Wiring up a loader, a splitter and a vector store in an hour lets you test whether the idea works at all. Throw it away afterwards.
- **Document-heavy ingestion.** LlamaIndex in particular is built around loading, parsing, chunking and indexing messy sources. If that is your core problem, its connectors save real time. Writing fifteen file-format parsers is not a good use of a small team.
- **Real agent graphs.** If you need durable state, branching, human approval steps and resumable runs, something like LangGraph gives you a model for that. Building your own state machine with checkpointing is real work.

Whichever route you take, keep the seams narrow. Put the framework behind your own interface, so the rest of the codebase calls classify(email), not a chain object. If you later rip it out, you change one module. The same discipline applies if you plan to [run multiple LLMs in production](/blog/running-multiple-llms-production-beyond-gateway.html): a small interface of your own makes provider swaps boring.

And log the final request yourself, whatever the framework does. Tracing that stops at the framework boundary is the reason [LLM observability takes more than logs](/blog/llm-observability-logs-arent-enough.html).

## Where this breaks

Custom code isn't free. If you write everything yourself, you will end up re-implementing pieces: retry with backoff, streaming, tool-call loops, structured output validation. Done well, that is a few hundred lines. Done badly, you've built a worse framework with no documentation and one author.

It also gets harder as the workflow grows. Once you have many tools, nested agents and conditional paths, hand-rolled control flow turns into tangled callbacks. That is the point where a graph abstraction stops being overhead and starts being structure.

Team size matters too. A solo engineer who knows the provider API well can go custom from day one. A team of mixed experience may benefit from a shared vocabulary, even an imperfect one, and from examples and community answers to lean on.

Finally, if the capability is a commodity, don't build the orchestration at all. Our piece on [when off-the-shelf AI wins](/blog/build-vs-buy-ai-features-off-the-shelf.html) covers that call.

## Practical next step

This week, take your most important AI workflow and answer one question: can an engineer print the exact prompt and raw response for a single production request in under five minutes? If not, add that capability first. Log the final request body and the raw output with a prompt version and a request ID.

Then count the framework features you actually use. If it's the loader and the model call, replace those with direct code and keep the framework for the prototype folder. If you're running a genuine multi-step agent and aren't sure which side of the line you're on, [Start a project](https://telaloom.com/contact.html) with us and we'll review the architecture with you.

<!-- RELATED_START -->

## Related articles

- [Zapier vs Custom Code: A Real Decision Framework](https://telaloom.com/blog/zapier-n8n-vs-custom-code-decision-framework.html)
- [Build vs. Buy for AI Features: When Off-the-Shelf Wins](https://telaloom.com/blog/build-vs-buy-ai-features-off-the-shelf.html)
- [AI Agent or Automation? Choose Wisely for Production.](https://telaloom.com/blog/ai-agent-vs-automation-production.html)
- [Why Most AI Agent Projects Never Make It Past the Demo](https://telaloom.com/blog/ai-agent-demo-to-production-gap.html)

<!-- RELATED_END -->
