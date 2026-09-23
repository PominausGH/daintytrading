---
title: "Do You Actually Need a Vector Database in 2026?"
description: "Most teams reach for Pinecone when pgvector would do. Here's how to pick between Postgres, Qdrant, Weaviate, and Pinecone based on real workloads."
category: "AI · Engineering"
publishedDate: "2026-09-19"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

You need a vector database when you have enough embeddings that a linear scan is too slow, and your query patterns need approximate nearest-neighbor search with metadata filtering at low latency. For most teams building their first RAG feature, that threshold is further away than the marketing suggests — under a few hundred thousand vectors, Postgres with pgvector will outperform the operational cost of running a dedicated vector store. The decision isn't "which vector database" first. It's "do I need one at all," and then "which one, for this specific workload."

Where we've needed retrieval in our own products — [ConvoForge](/projects/convoforge.html), and the pre-launch ChatVault and Second Brain — it has been Postgres with pgvector, not a separate vector database. Just as often, the honest answer is no retrieval at all: [CV Matcher](/projects/cv-matcher.html) scores one CV against one job per call, and needs no embeddings.

## The common wrong approach

The default move is: read a RAG tutorial, see Pinecone in the architecture diagram, sign up, and wire it in before you've written a single retrieval query against your own data. It feels reasonable — Pinecone's docs are excellent, the SDK is five lines of code, and "vector database" sounds like infrastructure a serious AI product should have.

Where it breaks: you're now running a second database for data that's a strict subset of what's already in Postgres. You've got sync logic to keep embeddings consistent with your source-of-truth rows, a second place for backups and access control, and a monthly bill that scales with vector count regardless of query volume. The sync job can easily end up being more code than the search feature itself — and at modest scale, pgvector's query latency is often close enough that the second database buys you nothing.

## The better approach: match the store to the workload

Start by naming the actual use case, because "vector database" covers three genuinely different problems:

**RAG over your own documents (under ~1M chunks):** Use Postgres with pgvector. If your data already lives in Postgres — and for most B2B SaaS products it does — you get ACID transactions, joins between embeddings and business data, one backup strategy, and one thing to monitor. HNSW indexing in pgvector (available since v0.5, mature by now) gets you sub-50ms queries at hundreds of thousands of vectors on a mid-tier instance. No new vendor, no new bill, no sync job.

**Semantic search at real scale (10M+ vectors, high QPS, frequent updates):** This is where dedicated stores earn their keep. Qdrant is our default recommendation — open source, self-hostable or managed, genuinely fast filtered search, and a pricing model that doesn't punish you for storing metadata alongside vectors. It fits workloads where write volume is constant and filter-heavy queries (by tenant, by date, by content type) need to stay fast under load. Weaviate is a reasonable alternative if you want built-in hybrid search (BM25 + vector) out of the box without assembling it yourself — useful if your queries are a mix of exact keyword matches and fuzzy semantic ones.

**Recommendations and large-scale production search (Pinecone territory):** Pinecone earns its cost when you need a fully managed service with minimal ops overhead, multi-region replication, and you're past the point where engineering time is cheaper than a SaaS bill. It's the right call for a well-funded team scaling a recommendation engine, not for a startup validating whether RAG improves their product.

If you're weighing this tradeoff for a client-facing product and want a second opinion on the workload before committing to infrastructure, that's a conversation worth having early — you can [start a project](https://telaloom.com/contact.html) with us before you've picked a vendor, not after.

## Where this breaks

pgvector's HNSW index rebuilds get expensive as your table grows past a few million rows, and write-heavy workloads (constant re-embedding, high insert rate) will make your primary Postgres instance sweat in ways that affect your actual application queries, not just search. That's the real signal to migrate to a dedicated store — not vector count alone, but write contention with your transactional workload. Separately, if you need multi-tenant isolation with strict per-tenant quotas and billing, Qdrant and Weaviate's collection models handle that more cleanly than bolting row-level security onto a shared pgvector table. And if your team has zero database ops experience and needs something running today with no self-hosting story, Pinecone's onboarding is genuinely faster than anything else here — that convenience has a price, but it's a legitimate reason to pay it.

## Practical next step

Before choosing a vector database, run one query: count your current or projected embeddings, and check whether your data already lives in Postgres. If it's under a million vectors and Postgres is already your source of truth, add the pgvector extension this week and benchmark HNSW search against your real queries before evaluating anything else. If you're already past that scale or hitting write contention, trial Qdrant's free tier against your actual filter patterns — not a synthetic benchmark — before signing an annual Pinecone contract.
