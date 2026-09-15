---
title: "How Do You Manage Long Context Windows in Production LLMs?"
description: "Summarization, RAG, and sliding windows solve different context problems — here's when to use each and where they fail in production."
category: "AI · Engineering"
publishedDate: "2026-09-16"
readTime: "5 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

You manage long context in production by choosing the right tool for what's actually growing: use retrieval-augmented generation when the corpus is large and mostly irrelevant to any single query, use summarization when conversation history needs to persist but doesn't need to persist exactly, and use a sliding window when only recent turns matter at all. Most teams pick none of these on purpose — they just raise the token limit and hope. That's the wrong approach, and it fails in a specific, predictable way.

## The wrong approach: just use a bigger window

Claude and GPT-5-class models now ship with context windows large enough that "just put it all in" feels like a reasonable engineering shortcut. No retrieval pipeline, no summarization logic, no vector database to maintain. For a demo, this works fine.

In production it breaks in three ways. First, cost — you're paying input-token rates on every request for context the model doesn't need for that specific query. Second, latency — time-to-first-token scales with prompt length, and a support agent that takes 12 seconds to respond because it's re-reading 40,000 tokens of chat history isn't shippable. Third, and most dangerous: quality degrades well before you hit the token ceiling. Models attend unevenly across long contexts — details buried in the middle get missed more often than details at the start or end. We've watched an agent confidently ignore a customer's stated deadline because it was on page 3 of an 11-page thread dump. The window didn't overflow. The model just didn't use it well.

## What actually works: match the strategy to the data shape

**RAG** is right when you have a large, mostly-static corpus and each query only needs a slice of it. On CV Matcher, we're not stuffing every résumé into context — we embed candidate documents once, embed the job requirement, and retrieve the top-k relevant chunks per query. The failure mode here is latency, not accuracy: embedding lookups, reranking, and the generation call itself stack up, and if your vector database is doing a naive cosine search over millions of vectors without an approximate nearest-neighbor index (pgvector with HNSW, or a dedicated store like Pinecone or Weaviate), you'll feel it. Budget for reranking too — raw vector similarity retrieves plausible chunks, not necessarily the right ones.

**Summarization** is right when history needs to persist as context, not as source material — a multi-turn support conversation, an ongoing agent session. On Email Triage, we summarize resolved thread history into a compact running state rather than replaying every prior message. The pitfall is real: summarization is lossy by design, and it's easy to compress away the one detail — a specific SKU number, an exact dollar figure, a name spelled an unusual way — that mattered. The fix isn't "summarize less," it's separating what can be compressed from what must be preserved verbatim. Keep structured facts (dates, IDs, amounts) in a separate state object outside the summary, and only summarize the narrative parts.

**Sliding windows** are right when recency is the actual signal — live chat, a coding agent mid-task, anything where turn N-50 is genuinely irrelevant to turn N. This is the cheapest option and the one people underuse because it feels too simple. On Ghost Writer, drafting sessions use a sliding window over recent edits plus a pinned style brief, rather than replaying the entire editing history.

Most production systems — BrightPath is a good example — end up combining two of these: RAG over a knowledge base, plus a sliding window or rolling summary over the live conversation on top.

## Where this gets complicated

RAG adds a real infrastructure dependency — a vector database is one more thing to provision, monitor, and pay for, and for a small team with a corpus under a few hundred documents, it's often not worth it. A well-organized prompt with the whole corpus, or even a simple keyword filter before generation, beats a half-maintained RAG pipeline. Summarization adds a second LLM call (and a second point of failure) to every request that needs it — if that call fails or drifts, your agent's "memory" silently corrupts. And sliding windows quietly lose information the moment something outside the window turns out to matter later; you need an explicit mechanism (pinned facts, a scratchpad) for anything that must survive regardless of recency.

## What to do this week

Pull one production conversation or session log that's currently getting dumped wholesale into your prompt, and classify each piece of it: static reference material (candidate for RAG), narrative history (candidate for summarization), or recent turns (candidate for a sliding window). You'll usually find it's not one strategy but two stacked together. If you want a second pair of eyes on the architecture before you build it, [start a project](https://daintytrading.com/contact.html) with us — this is the kind of tradeoff that's much cheaper to get right before you've built the pipeline than after.
