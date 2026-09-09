---
title: "How to Add AI to an Existing SaaS Without Rewriting It"
description: "Most SaaS products don't need a rebuild to get AI features. They need one well-chosen workflow, a clean API endpoint, and a prompt that doesn't hallucinate on your data. Here's the pattern we use."
category: "AI · Engineering"
publishedDate: "2026-05-20"
readTime: "6 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

<h2>The rewrite trap</h2>
          <p>The first thing most founders want to do when they decide to add AI is rewrite their product. New architecture, new stack, AI-native from the ground up. This is almost always the wrong call. You have a working product, paying customers, and production data. A rewrite puts all three at risk for the sake of catching up to a trend.</p>
          <p>The better question is: <strong>which one workflow in your product would be meaningfully better if an LLM touched it?</strong> Start there. Build a clean boundary around it. Swap out the old logic for an AI-powered endpoint. Ship it. Then pick the next one.</p>

          <h2>The three workflows worth retrofitting first</h2>
          <p>After building <a href="/projects/emailtriage.html">Email Triage</a>, <a href="/projects/missed-calls.html">Everyring.ai</a>, and several client retrofits, we keep landing on the same three categories as the highest-value first moves:</p>

          <h3>1. Draft generation</h3>
          <p>Anywhere your users are writing from scratch — replies, reports, summaries, proposals — an LLM can produce a first draft that your user edits down to 10 seconds of work. The AI doesn’t need to be right, it needs to be 80% right and fast. Draft generation is the single easiest retrofit because the blast radius of a bad output is low: the user sees it before it goes anywhere.</p>

          <h3>2. Classification and triage</h3>
          <p>Anywhere you have incoming items that need to be routed, prioritised, or labelled — support tickets, leads, emails, documents — a classifier prompt outperforms rules-based systems by a wide margin on edge cases. The output is structured (a label, a score, a category), which means it slots directly into your existing database schema. No UI changes required.</p>

          <h3>3. Structured extraction</h3>
          <p>Anywhere unstructured text needs to become structured data — receipts, contracts, forms, call transcripts — an LLM with a well-designed output schema replaces a fragile regex pipeline. Tools like Claude’s tool use or structured outputs make this reliable enough for production.</p>

          <h2>The integration pattern</h2>
          <p>The implementation is simpler than it looks. You add one new API endpoint to your existing backend. That endpoint receives the relevant context (the email, the ticket, the document), calls an LLM with a prompt you control, and returns a structured response. Your existing frontend and database don’t change. The LLM is a function call, not an architecture.</p>

          <p>In pseudo-code, the endpoint looks like this:</p>
          <p><code>POST /api/ai/triage</code><br>
          Input: <code>{ item_id, content, context }</code><br>
          → fetch full context from your DB<br>
          → build prompt<br>
          → call LLM API<br>
          → parse structured response<br>
          → write result back to your DB<br>
          Output: <code>{ priority, category, suggested_action }</code></p>

          <p>Your existing UI reads from the same database it always has. The AI result is just another field.</p>

          <h2>What actually takes time</h2>
          <p>The API call is not the work. The work is:</p>
          <ul>
            <li><strong>Prompt engineering.</strong> Getting the model to produce consistently structured output on your specific data distribution takes iteration. Budget a week of prompt work before you call it done.</li>
            <li><strong>Handling model failures.</strong> LLMs occasionally return malformed JSON, refuse to answer, or produce outputs outside your expected range. Your retry logic and fallback behaviour matters.</li>
            <li><strong>Evaluation.</strong> You need a way to measure whether the AI output is good. Eyeballing a sample isn’t enough at scale. Even a simple spreadsheet-based eval set of 50 real examples beats nothing.</li>
            <li><strong>Cost monitoring.</strong> Token costs at low volume feel trivial. At 10,000 calls/day they are not. Wire up cost tracking before you launch.</li>
          </ul>

          <h2>Use a gateway, not direct API calls</h2>
          <p>Don’t hard-code calls to <code>api.anthropic.com</code> directly. Route through a gateway like <a href="https://litellm.ai" rel="noopener" target="_blank">LiteLLM</a> or <a href="https://openrouter.ai" rel="noopener" target="_blank">OpenRouter</a>. You get model switching without code changes, request logging, rate-limit handling, and cost tracking for free. When Anthropic releases a better model next quarter, you change one config value, not ten API call sites.</p>
          <p>We self-host LiteLLM across our entire portfolio. Every product routes through the same gateway. This is part of our <a href="/services.html">AI infrastructure work</a> for clients too — it’s the first thing we stand up.</p>

          <h2>A realistic timeline</h2>
          <p>A single well-scoped AI workflow — from discovery to production — takes four weeks in our experience. Week one is discovery and architecture. Weeks two and three are the build. Week four is integration testing, evaluation, and deploy. If it’s taking longer than that, the scope is too broad.</p>
          <p>If you want to talk through what that looks like for your product, <a href="/contact.html">drop us a note</a>. We’ll tell you honestly whether your workflow is a good first candidate.</p>


          <div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
            <p><strong>We build production AI, not prototypes.</strong>
            If you’re looking to ship something like what’s described here — see
            <a href="/services.html">how we work</a> or
            <a href="/contact.html">start a project brief →</a></p>
          </div>
