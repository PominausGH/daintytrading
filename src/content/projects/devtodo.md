---
type: "product"
status: "dev"
name: "DevTodo"
title: "DevTodo — AI Task Manager for Developers | TelaLoom"
description: "DevTodo pulls TODOs from your code, syncs Google Calendar, runs through n8n, and uses Claude (via LiteLLM) to write task summaries and estimates. Built for developers who hate writing tickets."
ogTitle: "DevTodo — AI task manager for developers"
ogDescription: "Pulls TODOs from code, syncs Calendar, summarises with Claude."
ogImage: "https://telaloom.com/og/devtodo.png"
lede: "A task manager that meets developers where they already work. It reads TODOs from the codebase, syncs them to Google Calendar, runs through n8n for the wiring, and uses Claude to write the bits humans usually skip — titles, summaries, estimates."
metaChips:
  - label: "Category"
    value: "AI · Developer tools"
  - label: "Stack"
    value: "Node · Express · React"
  - label: "LLM"
    value: "LiteLLM (Claude)"
  - label: "Status"
    value: "Paused"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Paused (no public instance)"
    - label: "API"
      value: "Node · Express"
    - label: "Frontend"
      value: "React"
    - label: "Database"
      value: "Postgres"
    - label: "Orchestration"
      value: "n8n"
    - label: "LLM Routing"
      value: "LiteLLM"
    - label: "Calendar"
      value: "Google Calendar API"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "StoryPulse"
  href: "/projects/storypulse.html"
nextLink:
  label: "ChefForge"
  href: "/projects/chefforge.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "DeveloperApplication"
  operatingSystem: "Web · CLI"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Most engineers have two task lists: the one in Jira nobody reads, and the <code>// TODO</code> comments scattered through the code. The first list is for the company; the second is the truth. We wanted a task manager that started from the truth and pulled the rest of the workflow toward it.</p>

<h2>What we built</h2>
<p>DevTodo watches a configured set of repos for TODO/FIXME comments and creates a task per occurrence, tagged with the file, line, and Git author. Tasks flow into a React dashboard and out to Google Calendar with smart blocks (focus blocks, batch blocks, deadline blocks). The whole thing runs as Express APIs orchestrated by n8n flows so non-engineers can extend it without redeploying.</p>

<h2>The AI angle</h2>
<p>Claude (routed through LiteLLM so we can swap models at will) does three jobs: it reads the surrounding code and writes a one-line task title; it estimates effort in 15-minute buckets; it suggests a calendar slot type based on the work type (research, ship, polish). All three suggestions are editable, but the defaults are good enough that most users accept them silently.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Solo developers</strong> use the CLI to capture TODOs without breaking flow.</li>
<li><strong>Small teams</strong> use the dashboard as a low-friction Kanban that mirrors the code.</li>
<li><strong>Anyone using n8n</strong> hooks DevTodo into their existing automation graph.</li>
</ul>

<h2>What it taught us</h2>
<p>That building <em>for</em> developers means making the AI optional. Half our users turned off the LLM features in the first week and used DevTodo as a plain TODO scraper. Then over the next month they turned them back on, one at a time, as they decided what was actually useful. The lesson: ship the deterministic core first; let AI be a switch, not a foundation.</p>
