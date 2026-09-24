---
type: "product"
status: "testing"
unlisted: true
name: "Second Brain"
title: "Second Brain — Telegram Note-Taking with AI Recall | TelaLoom"
description: "Second Brain is a Telegram-based note-taking system. Forward anything — text, voice, photos, links — and Claude organises, tags, and surfaces it back when you actually need it."
ogTitle: "Second Brain — Telegram-native note-taking"
ogDescription: "Forward to a bot, AI organises, you find it again instantly."
ogImage: "https://telaloom.com/og/second-brain.png"
lede: "A note-taking system you already know how to use, because it lives where you already live: Telegram. Forward anything — voice, photo, link, half-written thought — and Claude organises it, tags it, and gives it back to you when you actually need it."
metaChips:
  - label: "Category"
    value: "AI · Knowledge management"
  - label: "Stack"
    value: "Python · Postgres · pgvector"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In final testing"
    - label: "Interface"
      value: "Telegram"
    - label: "Backend"
      value: "Python"
    - label: "Database"
      value: "Postgres · pgvector"
    - label: "Capture"
      value: "Voice · Photo · Link · Text"
    - label: "LLM"
      value: "Anthropic Claude"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Tax Prep"
  href: "/projects/tax-prep.html"
nextLink:
  label: "ConvoForge"
  href: "/projects/convoforge.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "ProductivityApplication"
  operatingSystem: "Telegram"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Note-taking apps fail at the capture step, not the storage step. The friction of opening Notion, choosing a database, picking a template, and typing a title is the reason most thoughts evaporate. Meanwhile, everyone with a phone has a chat window already open. We wanted a knowledge base that started with the chat window and let everything else happen quietly in the background.</p>

<h2>What we’re building</h2>
<p>Second Brain is a Telegram bot you forward things to. Voice notes get transcribed; photos get OCR’d; links get fetched and summarised; plain messages get filed. Claude reads each capture, decides what kind of thing it is (idea, task, reference, memory, contact), tags it, and links it to anything related you’ve already saved. Storage is Postgres with <code>pgvector</code> for semantic search.</p>
<p>Recall is the other half. You ask the bot in plain English — “what was that book a friend recommended in March about negotiation?” — and Second Brain searches embeddings, ranks candidates, and returns the original capture with the surrounding context. No app to open, no folder to remember, no tag to have created.</p>

<h2>The AI angle</h2>
<p>Three Claude calls per capture. The first decides the type. The second writes a one-line summary and a set of tags. The third looks at recent captures and proposes links (“this looks like a follow-up to the Tuesday note about onboarding”) for you to confirm or ignore. Recall uses embeddings first, then Claude to re-rank the top candidates against the query — the combination is what makes “the book about negotiation from March” actually find the right note.</p>

<h2>How it’ll be used</h2>
<ul>
<li><strong>Founders</strong> who think in voice notes between meetings.</li>
<li><strong>Researchers</strong> who collect snippets faster than they can file them.</li>
<li><strong>Anyone with a chat-first workflow</strong> who’s tried — and abandoned — three other note apps.</li>
</ul>

<h2>Where we are</h2>
<p>Capture, transcription, OCR, and tagging are working. Semantic recall is in private testing. The next milestone is the link-suggestion layer and a small web view for browsing the corpus. Expect a public beta in the second half of 2026.</p>
