---
title: "What Actually Happens in Week One With an AI Automation Partner"
description: "A concrete walkthrough of a discovery week: what gets mapped, what gets ruled out, and the deliverable you should walk away with."
category: "Process"
publishedDate: "2026-08-29"
readTime: "4 min"
ogImage: "https://daintytrading.com/og-card.png"
---

<p>Most "discovery" engagements produce a slide deck. Ours produces a decision: which workflow to automate first, which ones to leave alone, and what it costs to find out you were wrong. A good discovery week ends with a scoped pilot and a rejected list — not a roadmap that reads well in a boardroom and dies on contact with your actual data.</p>

<p>Here's what that week looks like when we run it, and what should be sitting on your desk at the end of it.</p>

<h2>The wrong version of this week</h2>

<p>The common failure mode is starting from the tool instead of the problem. Someone in leadership has seen a demo — an agent that reads inboxes, a chatbot that handles support tickets — and the brief becomes "build us that." Discovery turns into a requirements-gathering exercise for a predetermined solution. Teams skip straight to architecture diagrams and model selection before anyone has looked at the actual documents, tickets, or emails the system will touch.</p>

<p>It seems efficient. It isn't. We've inherited two projects this year where the client had already picked a vendor and a model before anyone checked whether the source data was even structured enough to automate against. In one case, three months of "inbox triage" work assumed clean subject-line categorization that didn't exist — the emails were a mess of forwarded threads and inconsistent formatting nobody had actually opened before scoping the build. The fix wasn't a better prompt. It was going back to week one, which they'd skipped.</p>

<h2>What we actually do</h2>

<p>Day one is data, not tools. We ask for real samples — actual emails, actual support tickets, actual documents — not descriptions of them. On <strong>Email Triage</strong>, that meant pulling 200 real threads before writing a line of code, because the client's mental model of their inbox and the inbox itself were two different things. You cannot scope an automation against a description of data. You scope it against the data.</p>

<p>Day two and three, we map the workflow as it's actually performed, not as it's documented. We sit with whoever does the task today — a recruiter screening CVs, an editor reviewing drafts — and watch where they hesitate, where they override the "standard" process, and where judgment calls happen that no SOP mentions. On <strong>CV Matcher</strong>, this surfaced that "good fit" was doing three different jobs depending on which hiring manager was asking. That's the kind of thing that never shows up in a requirements doc but breaks an automation on day one of production.</p>

<p>Day four, we rule things out. This is the part clients don't expect but end up valuing most. Not every workflow is worth automating with an LLM. Some are better served by a deterministic rule, a regex, or honestly, nothing — the volume doesn't justify the maintenance cost. On <strong>AutoArchive Mail</strong>, we killed two of the three proposed automations before writing code, because the actual volume was low enough that a human doing it manually cost less than building and maintaining a pipeline. Ruling things out is the deliverable, not a failure to find work.</p>

<p>Day five, we write the scope. Not a roadmap — a single pilot: one workflow, a defined success metric, a cost estimate for both build and ongoing inference, and an explicit list of what we're not building yet. If you want to see how this plays out end to end, <a href="https://daintytrading.com/contact.html">start a project</a> and we'll walk you through what week one would look like for your specific stack.</p>

<h2>Where this breaks</h2>

<p>A full discovery week is overkill for a genuinely small, well-bounded task — if you already know exactly what the input and output look like and the volume is low, spend a day, not a week. It also breaks down when the client can't produce real data during the engagement — NDAs, data residency rules, or simply nobody having export access. We've had discovery weeks stall entirely on day one waiting for a data export that took two weeks to clear legal. If you can't get us real samples, tell us before we start, not after.</p>

<p>And discovery doesn't replace evals. It tells you what's worth building and roughly how well it needs to perform. It doesn't tell you whether your first prompt actually hits that bar — that's a second phase, with its own week.</p>

<h2>This week</h2>

<p>Before you brief anyone on an AI project, pull 50–200 real examples of the thing you want automated — actual emails, actual tickets, actual documents, not a description of them. Look at them yourself for twenty minutes. If you find inconsistencies your team hasn't mentioned, that's your actual scope. If it looks cleaner than expected, you've probably found your fastest pilot.</p>
