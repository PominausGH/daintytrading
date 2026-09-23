---
title: "Why We Run Evals Before Shipping Any AI Feature Change"
description: "“It looked right when I tried it” isn't a test. Here's why a real eval set should gate every prompt or model change before it ships."
category: "AI · Engineering"
publishedDate: "2026-09-02"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.png"
---

<p>You tweak a prompt, run it against the three examples in your test file, and the output looks better. You ship it. Two days later, support tickets start coming in about a feature that was working fine last week. Nobody touched that code path. Except someone did — the prompt change that "looked right" broke a case that wasn't in your three examples.</p>

<p>This is the most common failure mode we see in AI features, including ones we've shipped ourselves before we knew better. Eyeballing outputs is not evaluation. It's vibes with extra steps. And vibes don't scale past the handful of inputs you happen to think of while you're staring at a terminal.</p>

<h2>The common wrong approach</h2>

<p>Most teams test AI changes the way they'd test a CSS tweak: change something, look at the result, does it look okay, ship it. For a classification prompt, that might mean running five emails through it and reading the outputs. For a system prompt change, it's asking the assistant a couple of questions in the playground.</p>

<p>This feels reasonable because it's fast, and because the change usually does look better on the examples you tried. The problem is selection bias — you tried the examples that came to mind, which are usually the cases you were already thinking about when you made the change. You did not try the weird timezone in the email footer, the customer who writes in all lowercase with no punctuation, the PDF attachment with no text layer, or the ticket that's actually two unrelated requests glued together. Production traffic is stranger than your imagination, every time. A change that improves the case you were focused on can silently regress ten cases you weren't.</p>

<h2>The better approach</h2>

<p>The fix: don't ship a prompt, model, or pipeline change without running it against an eval set first. Concretely, that means: a fixed set of real (or realistic, anonymized) inputs with known-good expected outputs or scoring criteria, run automatically, with a pass/fail or score delta reported before merge.</p>

<p>On <strong><a href="/projects/emailtriage.html">Email Triage</a></strong>, our own inbox triage product, the eval set should be real emails hand-labelled with the correct category and priority. Every prompt or model change runs against that set, and you look at three numbers: overall accuracy, per-category accuracy (because aggregate accuracy hides category-specific regressions), and a diff of exactly which examples flipped from correct to incorrect. That last part matters more than the aggregate score — a change that keeps accuracy flat while flipping a different set of ten emails is not a neutral change, it's two regressions and two fixes disguised as no-op.</p>

<p>For generative tasks like <strong><a href="/projects/ghost-writer.html">Ghost Writer</a></strong>, where there's no single correct output, we use an LLM-as-judge scored against a rubric (tone match, factual grounding against source material, length constraints) plus a small set of hard-fail checks that don't need a judge at all — did it hallucinate a name, did it exceed the character limit, did it drop a required disclaimer. The rubric-scored judge catches drift; the hard-fail checks catch the embarrassing stuff a judge might rate charitably.</p>

<p>The infrastructure here doesn't need to be fancy. A script that loops over a JSON file of test cases, calls the model, and diffs against expected results is enough to start. What matters is that it runs on every change, not just the ones you remember to test by hand.</p>

<h2>Where this breaks</h2>

<p>Eval sets have real costs. Building the first 100–200 labeled examples takes real hours, usually from someone who understands the domain well enough to label correctly — that's not a job you hand to whoever's free. LLM-as-judge evals introduce their own noise; the judge model has opinions, and those opinions drift when you change judge models, so you need to periodically sanity-check the judge against human ratings. And for a genuinely new feature with no production traffic yet, you're evaluating against synthetic or small-sample data, which catches obvious breaks but won't catch everything real users will find.

For a very small team shipping a low-stakes internal tool, a lightweight eval set — even 20 hand-picked hard cases — beats nothing, but don't expect it to catch everything a 200-example set would. The eval set is an investment that pays off in proportion to how much damage a silent regression would do. A typo-correction feature can probably skip this. A feature that routes support tickets or drafts customer-facing emails cannot.</p>

<p>If you're building an AI feature and don't have an eval set yet, don't try to build the perfect one this week. Pull 20–30 real examples from logs or support tickets, write down what the correct output should have been, and script a comparison against your current output. That's enough to catch the next "looked right when I tried it" regression before your customers do. If you want help setting up <a href="/services/ai-infrastructure.html">eval infrastructure</a> that actually gets used instead of abandoned after the first sprint, <a href="https://telaloom.com/contact.html">start a project</a> with us.</p>
