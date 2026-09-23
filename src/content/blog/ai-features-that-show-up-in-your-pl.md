---
title: "The AI Features That Actually Show Up in Your P&L"
description: "Most AI features don't move the needle. A few do — reliably and measurably. Here's how to tell the difference before you build, with examples from production."
category: "Strategy"
publishedDate: "2026-04-29"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

<h2>The test before you build</h2>
<p>Before scoping any AI feature, we ask one question: <strong>can you define what success looks like as a number you already track?</strong> Not a new metric created to justify the feature — an existing one. Time per task, support tickets opened, churn rate, content output per headcount, conversion rate.</p>
<p>If you can’t name the number before you build, you almost certainly won’t be able to attribute a change in it to the AI feature after you build. The feature becomes “hard to measure” — which is usually true and means it doesn’t show up in your P&amp;L.</p>

<h2>Features that reliably move the needle</h2>

<h3>Support deflection</h3>
<p>An AI that handles the most common 40% of support queries before they reach a human agent is directly measurable: tickets per day, resolution time, cost per ticket. The constraint is that it has to work reliably on the common cases — users who get a bad answer from an AI and then have to escalate cost more than the original ticket. Build the deflection layer for the easy, repetitive queries only. Let humans handle the rest.</p>
<p>This is the AI feature with the clearest and fastest ROI calculation in B2B software. You know your support cost per ticket. You can measure deflection rate. The maths writes itself.</p>

<h3>Draft generation for high-volume writing tasks</h3>
<p>Anywhere a human is writing the same type of thing repeatedly — support replies, status reports, outreach emails, job postings, product descriptions — an AI draft they edit down to a final version compresses time from minutes to seconds per item. The output per headcount number goes up measurably.</p>
<p>This is what our <a href="/projects/ghost-writer.html">Ghost Writer</a> does for content pipelines: detect the topic, generate the draft, run it through quality checks, publish. The human work shifts from writing to choosing what's worth writing about.</p>

<h3>Lead and ticket triage</h3>
<p>Routing and prioritisation are invisible work that adds up fast. A classifier that correctly sorts incoming leads by intent, urgency, or segment means your sales or support team is always working the highest-value item first. The downstream metric — conversion rate, response time to high-priority leads — is something you almost certainly already track.</p>
<p>This is the core of <a href="/projects/emailtriage.html">Email Triage</a>: not replacing the human, but making sure the human is always looking at the right thing next.</p>

<h3>Extraction that eliminates manual data entry</h3>
<p>Structured data extracted from unstructured sources — receipts, invoices, call transcripts, contracts — directly replaces human hours. The metric is straightforward: how many documents does a person process per hour before and after. We're building <a href="/projects/receipt-bridge.html">Receipt Bridge</a> to eliminate manual expense entry for field teams. The before/after is a concrete headcount-hours number.</p>

<h2>Features that rarely show up in the P&amp;L</h2>

<h3>AI chatbots on marketing sites</h3>
<p>Almost universally these look good in demos and produce negligible measurable impact. Visitors who want to contact you use your contact form. The chatbot adds complexity, costs money to run, and the conversion lift is rarely attributable and rarely significant. We’ve seen a few exceptions — when the chat replaces a human doing live sales qualification — but as a default, this is low-ROI work.</p>

<h3>Summaries nobody asked for</h3>
<p>Adding an AI summary to the top of every dashboard widget, every email thread, every document feels valuable. In practice, if users weren’t reading the underlying content before, they’re not going to act on a summary of it either. Summaries earn their keep only when the underlying content is genuinely too long to skim and decisions depend on it.</p>

<h3>AI features that require users to change their workflow</h3>
<p>If the value of your AI feature depends on users doing something differently — switching to a new interface, adding a step, changing a habit — the adoption curve will kill your ROI measurement before you can make a fair assessment. The best AI features are invisible: they improve an output the user was already getting without changing how they work.</p>

<h2>The rule</h2>
<p>Build AI features that replace work the system was already doing (classification, triage, first drafts, extraction) before you build AI features that add new work to the system (chat interfaces, proactive recommendations, summaries). The former improves the economics of what you already have. The latter bets on adoption that may not materialise.</p>
<p>If you want a second opinion on which AI feature to build first, <a href="/contact.html">send us a note</a>. We have a consistent view on this after 38 products.</p>


<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you’re looking to ship something like what’s described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
