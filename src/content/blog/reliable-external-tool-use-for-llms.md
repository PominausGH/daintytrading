---
title: "Function Calling Isn't Enough: Building Reliable LLM Tool Use"
description: "Basic function calling breaks in production. Here's how we build schema validation, retries, and tool versioning into agents that call real APIs."
category: "AI · Engineering"
publishedDate: "2026-09-23"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

Your agent calls a tool, the API times out, and the model just... makes something up. It tells the user the calendar event was created. It wasn't. This is the failure mode that doesn't show up in the demo, because the demo never hits a rate limit, never gets a malformed argument, never calls a tool that changed its schema last Tuesday. In production, all three happen in the first week.

Function calling — the part where the model picks a tool and emits arguments — is the easy 20%. The other 80% is what happens after the model decides to call something: validating what it sent, handling what comes back, and knowing what to do when the tool itself has changed underneath you. That's the part almost nobody designs for up front, and it's the part that determines whether your agent is a toy or something you can put in front of customers.

## The common wrong approach

Most teams wire tool calls directly: the model emits a tool_use block, you JSON.parse the arguments, pass them straight into an SDK call or a fetch to an internal API, and pipe the result back into the next message. It works in testing because testing uses clean inputs and a responsive API.

It breaks three ways. First, models occasionally emit arguments that are syntactically valid JSON but semantically wrong — a string where you needed an ISO date, a made-up customer ID that doesn't exist. Second, external APIs fail: timeouts, 429s, 500s, flaky third-party dependencies you don't control. Teams that don't plan for this either crash the turn or, worse, let the model narrate a success that never happened. Third, tool definitions drift. Someone adds a required field to an internal API, the tool schema in the prompt doesn't get updated, and the agent starts failing calls silently because nobody owns the sync between "what the API expects" and "what the model was told to send."

## The better approach

Treat every tool call like an untrusted input at a system boundary, because that's what it is. We build three layers around it.

**Schema validation before execution.** Define tool schemas once, in a format like Zod or Pydantic, and generate both the JSON Schema you hand to the model and the runtime validator from the same source. When the model's arguments come back, validate before you touch a real API. If validation fails, don't crash — feed the validation error back to the model as a tool result and let it retry with corrected arguments. Models are good at fixing their own malformed calls when you show them exactly what was wrong; they're bad at guessing when you just return a generic error.

**Retries with real backoff, scoped to failure type.** Not every failure deserves a retry. A 429 or a network timeout should retry with exponential backoff and jitter, capped at two or three attempts. A 400 from a malformed request should go back to the model, not to a retry loop — retrying the same bad request just burns time. A 500 from a third-party API after retries exhaust should surface as an explicit tool failure, not a fabricated success. On [Email Triage](/projects/emailtriage.html), this distinction mattered a lot: transient Gmail API hiccups needed silent retries, but a genuinely rejected label update needed to become visible to the model so it could tell the user rather than assume it worked.

**Tool definitions as versioned, owned artifacts.** As an agent grows past four or five tools, treat the tool registry like an API contract, not a prompt fragment. Version each tool definition, changelog breaking changes, and run a CI check that fails the build if a tool's schema diverges from the underlying API it wraps. On [BrightPath](/projects/brightpath.html) and [CV Matcher](/projects/cv-matcher.html), we keep tool schemas in the same repo as the integrations they call and generate the model-facing JSON Schema at build time — never hand-written twice in two places that can drift.

If you're facing this on a client engagement and want a second set of eyes on the architecture, that's the kind of problem we like — [start a project](https://telaloom.com/contact.html) and we'll look at what you've got.

## Where this breaks

This is overhead, and for a two-tool prototype it's not worth it — write the try/catch, ship it, move on. The validation-retry-versioning stack earns its cost once you have real users, multiple tools, or tools that touch money, data deletion, or anything irreversible. It also doesn't solve everything: retries can't fix a genuinely down dependency, and no amount of schema validation stops a model from calling the right tool with plausible-but-wrong arguments — that's an [eval problem](/blog/why-we-run-evals-before-shipping-ai-features.html), not an engineering one. And if your tool surface changes weekly, the versioning discipline has to be enforced by CI, not by memory, or it decays within a month.

## Practical next step

This week, pick your highest-traffic tool and add exactly one thing: a schema validator that runs before the API call, returning validation errors as a tool result instead of letting bad arguments hit your backend. That single change catches the most common production failure — malformed arguments — before it costs you an API call or a bad user-facing outcome. Once that's in place, do the same for retry classification on that tool before expanding to the rest.
