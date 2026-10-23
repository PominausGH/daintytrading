---
title: "How to Automate Decisions With LLMs Without Losing Control"
description: "Use LLMs to classify, route and approve safely: constrain outputs, treat confidence as a measured signal, and escalate low-confidence cases to a human."
category: "Automation"
publishedDate: "2026-10-24"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

You keep control of LLM-made decisions by limiting what the model can say, checking what it says with code, and sending anything uncertain to a person. The model proposes. Your system decides. Teams that skip this get a workflow that works in the demo and quietly misroutes a few percent of real traffic, with nobody noticing until a customer complains.

This applies to any place an LLM picks from a set of options: classify a ticket, route a lead, approve a refund, flag a document. Here is the pattern we recommend.

## The common wrong approach

Most teams start by asking the model a question in plain English and acting on the answer. "Is this refund request legitimate? Answer yes or no." It works on the ten examples you tried, so it ships.

Then the failures show up. The model answers "Yes, though it depends on the policy" and your string match fails. It returns "Approved" instead of "yes." It hedges on the ambiguous cases, which are exactly the ones you care about. The worse failure is silent. The model is confidently wrong on an edge case, and your workflow treats a confident wrong answer the same as a confident right one.

The other trap is asking the model to rate its own certainty: "give a confidence from 0 to 100." Those numbers look precise. They are not calibrated. A model will say 92 on a coin-flip case. If you route on that number alone, you have built false assurance into the workflow.

## The better approach

Treat the LLM as a classifier inside a deterministic shell. Four pieces.

**1. Constrain the output.** Define a closed set of labels and require structured JSON: label, a short reason, and any fields you need downstream. Validate it in code. If it doesn't parse or the label isn't in your set, that is a failed decision, not a guess. Add an explicit "unclear" or "needs_review" label so the model has a legitimate way out instead of forcing a pick.

**2. Use few-shot examples for the boundaries.** Don't spend your examples on obvious cases. Spend them on the confusing ones: the two categories people mix up, the request that looks like a refund but is a complaint. Three to six well-chosen examples with the correct label and a one-line reason usually do more for consistency than a longer instruction block. Keep the prompt versioned so you know which version made which decision.

**3. Build confidence from signals, not self-report.** Useful signals include:

- Agreement across two or three independent runs. Disagreement means escalate.
- Token log probabilities, where your provider exposes them.
- Hard rule checks that run after the model. If the label says "approve" but the amount is over your limit, a rule overrides it.
- Whether the reason the model gave actually matches the label.

Then calibrate. Take a labelled sample of your own data, see where each signal separates right from wrong, and set the threshold from that. We cover the evaluation side in [how we evaluate LLMs beyond benchmarks](/blog/how-we-evaluate-llms-beyond-benchmarks.html).

**4. Escalate by default when uncertain.** Low confidence, failed parse, rule conflict, or an "unclear" label all go to a human queue. The queue needs the input, the model's proposed label and reason, and one-click accept or override. Log every override. Those overrides are your best source of new few-shot examples and your honest accuracy number.

On the product side, CV Matcher works this way. Each CV/job pair gets one Claude Haiku call that must return fixed JSON: a score, matched skills, missing skills and a short reason. Input text is truncated to a fixed budget. If the call fails or the output doesn't parse, it falls back to a deterministic TF-IDF/keyword score instead of guessing. You can see the product on the [CV Matcher page](/projects/cv-matcher.html). The principle carries over: the model is never the only path to a result.

## Where this breaks

This adds machinery, and it isn't always worth it.

If a wrong decision is cheap and reversible, such as tagging an internal note, skip the multi-run agreement check. One call plus schema validation is enough.

If the decision follows clear rules, don't use an LLM at all. A rules engine is cheaper, faster and fully auditable. Plenty of useful automation, such as archiving mail on a schedule by message ID, needs no model.

Human escalation has its own failure mode: the queue. If you set the threshold too loose, reviewers drown, start rubber-stamping, and you have lost control anyway. If you set it too tight, you automate nothing. Track the escalation rate and the override rate weekly. A high override rate on auto-approved items means your threshold is wrong. A high acceptance rate on escalated items means you can loosen it.

Multi-run agreement also multiplies cost and latency. And flaky provider calls need their own handling, so read our piece on [retry policies for LLM API calls](/blog/retry-policies-flaky-llm-api-calls.html) before you add three calls per decision.

## Practical next step

This week, pick one decision your team makes by hand and pull 100 past examples with their real outcomes. Write the closed label set, including "needs_review". Run the model over the sample and compare. Don't look at accuracy first. Look at the wrong answers and ask whether any signal would have flagged them.

If you're not sure the process is a good candidate, run it through [these four questions](/blog/ai-process-automation-4-questions.html) first. And if you'd rather have help designing the decision layer, escalation queue and thresholds, that's the kind of work we take on. You can [Start a project](https://telaloom.com/contact.html) and tell us which decision you want to automate.

<!-- RELATED_START -->

## Related articles

- [Zapier vs Custom Code: A Real Decision Framework](https://telaloom.com/blog/zapier-n8n-vs-custom-code-decision-framework.html)
- [Can AI Automate Your Process? Ask These 4 Questions.](https://telaloom.com/blog/ai-process-automation-4-questions.html)
- [How We Evaluate LLMs: Beyond Benchmarks](https://telaloom.com/blog/how-we-evaluate-llms-beyond-benchmarks.html)
- [Automate the Boring Step First, Not the Impressive One](https://telaloom.com/blog/automate-the-boring-step-first.html)

<!-- RELATED_END -->
