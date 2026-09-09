---
title: "Token Cost Optimization: Where the Savings Actually Are"
description: "The highest ROI strategies for reducing LLM token costs in production: prompt caching, model routing, context trimming, and output constraints."
category: "AI · Engineering"
publishedDate: "2026-06-07"
readTime: "5 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

<p>How do you optimize LLM token costs in production? The highest ROI comes from prompt caching, aggressive context trimming, routing simple tasks to smaller models, and capping output length. When you process 10,000+ requests a day, cutting your prompt context by 30% and caching the rest saves thousands of dollars a month. Most engineering teams overcomplicate cost reduction by immediately trying to fine-tune open-weights models or migrating to entirely new hosting ecosystems. The reality is that the fastest path to reducing your Anthropic or OpenAI bill by 80% is fixing your architecture and data hygiene, not replacing the frontier model entirely. The real savings are in the plumbing.</p>

<h2>The Common Wrong Approach</h2>

<p>The standard progression goes like this: you launch a feature using Claude 3.5 Sonnet or GPT-4o. It works great. Usage scales. Then you get your first $5,000 API bill, and the finance team starts asking questions. The immediate reaction from engineering is usually a knee-jerk pivot to hosting Llama 3 or Mistral locally, or trying to fine-tune a smaller model to handle the exact same workload.</p>

<p>This is almost always a mistake for small teams. The moment you decide to host your own inference, you trade a predictable API bill for DevOps salaries, GPU instance costs, and massive latency spikes. You spend six weeks wrestling with vLLM, TensorRT, and batching infrastructure instead of shipping product features.</p> 

<p>Or worse, you blindly swap your premium model for a cheaper one (like Claude 3.5 Haiku or GPT-4o-mini) across the board to save money quickly, only to watch your pipeline's accuracy tank. Customers complain, edge cases fail, and you realize the smaller model simply cannot handle the complex reasoning required for your core tasks without heavy hand-holding.</p>

<h2>The Better Approach</h2>

<p>Here is what actually works. At Dainty Trading, we run systems like CV Matcher and Email Triage processing tens of thousands of requests daily. We don't host our own models. We aggressively optimize how we use the big ones.</p>

<p>First: <strong>Prompt Caching.</strong> If you are passing the same 50-page PDF, dense system instructions, or extensive few-shot examples into every request, you are burning money on every call. Both Anthropic and OpenAI support prompt caching. By moving static context to the absolute top of your prompt and structuring your calls to reuse that cached prefix, we typically see a 50–80% reduction in input token costs. For a high-volume feature, this single architectural change is transformative.</p>

<p>Second: <strong>Model Routing by Task Complexity.</strong> Not every request needs a frontier model. In our document extraction pipelines, we route the heavy lifting—like analyzing a contract for subtle indemnification clauses—to Claude 3.5 Sonnet. But the subsequent tasks, like formatting the extracted entities into JSON, classifying the document type, or summarizing the output, get routed to Claude 3.5 Haiku. Haiku is dramatically cheaper and faster. Use a router abstraction in your code to split the workflow based on the cognitive load required for each step.</p>

<p>Third: <strong>Context Trimming.</strong> LLMs do not need the entire 50-message conversation history to answer a simple follow-up question. Implement a strict rolling window or a summarization step for chat applications. For RAG (Retrieval-Augmented Generation), strictly enforce a top-K limit on retrieved chunks. We mandate that no RAG payload exceeds 4,000 tokens unless the task specifically requires long-context synthesis. Filter your context before you pay to send it.</p>

<p>Fourth: <strong>Output Constraints.</strong> Output tokens are significantly more expensive than input tokens. Use the <code>max_tokens</code> parameter aggressively. If you expect a JSON boolean, cap the output at 10 tokens. If you ask for a summary, add "in under 50 words" to the prompt <em>and</em> cap the API parameter at around 75 tokens. It forces the model to be concise and physically prevents runaway generation loops from draining your balance.</p>

<h2>Where This Breaks</h2>

<p>This approach is not a silver bullet. Prompt caching only yields ROI if your cache hit rate is consistently high. If every user request features a completely unique, massive system prompt, or you are constantly shifting the order of your input messages, you will actually pay <em>more</em> due to cache-write premiums.</p>

<p>Model routing introduces significant architectural complexity. You now have to maintain multiple prompts tailored to different models, monitor performance across various endpoints, and handle varied rate limits and downtime. Sometimes, debugging a pipeline where step one uses Sonnet and step two uses Haiku takes twice as long because the errors cascade unpredictably between model behaviors.</p>

<p>For very low-volume applications—anything under a few hundred requests a day—the engineering time spent building a robust router and optimizing cache hits simply isn't worth the $20 a month you save. Keep it simple until the bill hurts.</p>

<h2>Practical Next Step</h2>

<p>To cut costs this week, start with your output tokens. Audit your highest-volume API calls and hard-code a <code>max_tokens</code> limit that is exactly 20% above your expected response size. It takes five minutes and stops bleeding immediately. Next, identify the largest static block of text in your inputs (usually system prompts or RAG context rules) and restructure your API calls to utilize provider-native prompt caching.</p>

<p>If you are dealing with spiraling inference costs and need help architecting a more efficient pipeline, <a href="https://daintytrading.com/contact.html">start a project</a> with us. We can help you implement these routing and caching strategies without degrading your product's performance or introducing unnecessary infrastructure complexity.</p>

<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you’re looking to ship something like what’s described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
