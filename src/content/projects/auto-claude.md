---
type: "product"
status: "testing"
name: "Auto-Claude"
title: "Auto-Claude — TelaLoom"
description: "An autonomous multi-agent coding framework. Give it a goal — build the feature, fix the bug, spike the prototype — and it plans, builds, runs tests, and iterates until something works, with a human in the loop only when it asks."
ogTitle: "Auto-Claude"
ogDescription: "An autonomous multi-agent coding framework. Give it a goal — build the feature, fix the bug, spike the prototype — and it plans, builds, runs tests, and iterates until something works, with a human in the loop only when it asks."
ogImage: "https://telaloom.com/og/auto-claude.png"
lede: "An autonomous multi-agent coding framework. Give it a goal — build the feature, fix the bug, spike the prototype — and it plans, builds, runs tests, and iterates until something works, with a human in the loop only when it asks."
metaChips:
  - label: "Category"
    value: "AI · Developer tools"
  - label: "Stack"
    value: "Python · FastAPI · React · Electron"
  - label: "LLM"
    value: "Anthropic Claude SDK"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In final testing"
    - label: "Site"
      value: "autoclaude.telaloom.com"
    - label: "Backend"
      value: "Python · FastAPI"
    - label: "Frontend"
      value: "React · Electron"
    - label: "Agents"
      value: "Planner · Code · Test · Review"
    - label: "LLM"
      value: "Anthropic Claude SDK"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Price Scout"
  href: "/projects/price-scout.html"
nextLink:
  label: "FakeCall"
  href: "/projects/fakecall.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>The interesting question with coding agents isn’t whether one Claude call can write a function. It’s whether a sequence of calls can hold a project state, recover from failures, and decide when to stop. Most agent frameworks either over-promise (one prompt, full app) or under-deliver (a chat that occasionally writes code).</p>

<h2>What we’re building</h2>
<p>Auto-Claude is a multi-agent runtime built directly on the Anthropic Claude SDK. A planner decomposes the goal into steps; specialist agents (research, code, test, review) take ownership of step types; a controller reconciles state and decides what runs next. The desktop app (Electron + React) is the operator’s console; the FastAPI backend is the engine.</p>

<h2>The AI angle</h2>
<p>The honest engineering is in the failure handling. Every agent run either succeeds, raises a structured failure with context, or asks the human a single specific question. The controller routes those failures back into the plan instead of silently retrying. This is the difference between a cute demo and a system you trust to run overnight.</p>
<p>Splitting the work across specialist agents rather than one long-running Claude call is what makes the state recoverable. A single agent that plans, codes, tests, and reviews in one continuous context loses track of what it already tried once the context gets long enough, and a crash mid-run means starting over. Handing each step type to its own agent, with the controller as the only thing holding overall project state, means a test-agent failure doesn’t corrupt what the code-agent already got right — the controller can re-run just the failed step, or escalate it as the one specific question a human actually needs to answer, instead of replaying the whole goal from scratch.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Solo developers</strong> who want a project-aware agent for evening tickets.</li><li><strong>Studios like ours</strong> using it to compress repetitive build work.</li><li><strong>Researchers</strong> studying multi-agent failure modes in production conditions.</li></ul>

<h2>Where we are</h2>
<p>Single-goal end-to-end runs are working on real codebases. Multi-day, multi-goal queues are in soak. Public access is gated on a model of cost transparency — users need to know mid-run how much the agent has spent.</p>
