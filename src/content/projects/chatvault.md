---
type: "product"
status: "testing"
unlisted: true
name: "ChatVault"
title: "ChatVault — One Searchable Archive for Every LLM Conversation | TelaLoom"
description: "ChatVault aggregates conversations from Claude, ChatGPT, Gemini, Grok, and Perplexity into a single searchable archive. Stop losing the answer you got three weeks ago in a different tab."
ogTitle: "ChatVault — your LLM conversations, all in one place"
ogDescription: "Aggregate Claude, ChatGPT, Gemini, Grok, and Perplexity into one searchable archive."
ogImage: "https://telaloom.com/og/chatvault.png"
lede: "One searchable archive for every conversation you’ve had with every model. Claude, ChatGPT, Gemini, Grok, Perplexity — all in one place, indexed by what you actually said and what they actually answered."
metaChips:
  - label: "Category"
    value: "AI · Knowledge management"
  - label: "Stack"
    value: "Python · Postgres · pgvector"
  - label: "Sources"
    value: "Claude · ChatGPT · Gemini · Grok · Perplexity"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In final testing"
    - label: "Site"
      value: "chatvault.telaloom.com"
    - label: "Backend"
      value: "Python"
    - label: "Database"
      value: "Postgres · pgvector"
    - label: "Sources"
      value: "Claude · ChatGPT · Gemini · Grok · Perplexity"
    - label: "Search"
      value: "Full-text + semantic"
    - label: "LLM"
      value: "Anthropic Claude (re-rank)"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Marketing OS"
  href: "/projects/marketing-os.html"
nextLink:
  label: "Tax Prep"
  href: "/projects/tax-prep.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "ProductivityApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>If you use multiple LLMs — and most serious users now do — your knowledge is scattered. The brilliant breakdown of a contract clause is in Claude. The code review that actually caught the bug is in ChatGPT. The one Gemini answer you keep meaning to come back to is somewhere on a different device. None of them talk to each other; none of them are searchable across providers; and none of them survive the moment you change subscriptions.</p>

<h2>What we’re building</h2>
<p>ChatVault is a single archive that ingests conversations from every major LLM provider — Claude, ChatGPT, Gemini, Grok, and Perplexity — through their export formats and APIs. Each conversation is stored in Postgres with full-text and semantic indexes (Postgres full-text + <code>pgvector</code>), plus a normalised schema for who-said-what, when, with which model, and at what cost.</p>
<p>Search works two ways: keyword (fast, exact, finds the Slack-paste of a regex) and semantic (slower, fuzzy, finds “that thing about negotiation tactics from a few weeks ago” without the right keywords). Results show the surrounding turns so you get the context, not just the snippet.</p>

<h2>The AI angle</h2>
<p>The interesting work is the recall layer. Embeddings catch the gist; re-ranking with Claude promotes the result that actually answers your question. We log the click-through — which result the user opened, whether they marked it useful — and use it to tune ranking over time. Over a few weeks of use the archive becomes meaningfully tailored to how you actually search.</p>

<h2>How it’ll be used</h2>
<ul>
<li><strong>Power users of multiple models</strong> who want one place that doesn’t care which provider produced the answer.</li>
<li><strong>Researchers and writers</strong> who use AI for thinking partners and want every prior thread retrievable.</li>
<li><strong>Engineers</strong> revisiting code reviews, prompt iterations, and debugging conversations across tools.</li>
</ul>

<h2>Where we are</h2>
<p>Ingest is working for Claude exports, ChatGPT exports, Gemini history, and Perplexity threads. Grok is the latest addition. Semantic recall is in private testing with a re-rank step. Next milestone is a small browser extension that captures conversations as you have them, instead of waiting on export-and-import.</p>
