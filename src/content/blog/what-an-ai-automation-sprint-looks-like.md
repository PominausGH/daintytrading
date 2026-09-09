---
title: "What an AI Automation Sprint Actually Looks Like"
description: "A fixed-scope, fixed-price, four-week AI automation engagement. Here's what happens each week, what you get at the end, and what we won't scope in."
category: "Process"
publishedDate: "2026-05-13"
readTime: "5 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

<h2>Why fixed scope matters for AI work</h2>
<p>AI projects have a reputation for scope creep. The promise is vast — “we could do so much with this data” — and the technology makes it easy to keep adding things. The result is a three-month build that delivers a prototype nobody uses in production.</p>
<p>We scope differently. Every engagement is a single sprint: one well-defined AI workflow, a fixed price, and a hard end date. You get something deployed and in production at the end of four weeks — not a roadmap, not a Figma file, not a demo that needs six more months. A working thing.</p>
<p>Here’s exactly what those four weeks look like.</p>

<h2>Week 1 — Discovery and architecture</h2>
<p>We spend the first week understanding the problem before we write a line of code. That means:</p>
<ul>
<li><strong>Workflow mapping.</strong> We trace exactly where AI enters, what context it needs, and what it hands back to your system.</li>
<li><strong>Data audit.</strong> We look at real examples of the inputs the model will see. Bad data discovered in week one costs nothing. Bad data discovered in week three costs a week.</li>
<li><strong>Model selection.</strong> We pick the right model for the task — not the most impressive one, the right one. For classification, a fast cheap model is usually better than a slow expensive one.</li>
<li><strong>Scope lock.</strong> We write a one-page scope document. Everything in it is in. Everything not in it is out. Both sides sign off before week two begins.</li>
</ul>

<h2>Week 2 &amp; 3 — The build</h2>
<p>Weeks two and three are heads-down development. By the end of week two you have a working internal version. The model is integrated, the prompt is drafted, and the output is writing to your database. By end of week three:</p>
<ul>
<li>The prompt is tuned against real data, not synthetic examples</li>
<li>Error handling and fallback behaviour is in place</li>
<li>Costs are instrumented and within budget</li>
<li>A basic eval set is passing — typically 50 hand-labelled examples we run against every prompt change</li>
</ul>
<p>We share progress async throughout. No weekly standups. A Loom walkthrough at the end of each week, a shared doc with notes, and a channel where you can ask questions.</p>

<h2>Week 4 — Integration, evaluation, and deploy</h2>
<p>Week four is about making it real. We integrate the AI endpoint with your existing product, run end-to-end tests against production data, and deploy to your infrastructure (or ours, if you don’t have any). At the end of the week you get:</p>
<ul>
<li>A production-deployed AI feature accessible to real users</li>
<li>A handover document covering the prompt, the architecture, the eval set, and how to tune it going forward</li>
<li>One week of post-launch monitoring included — we watch costs and output quality and fix anything that needs fixing</li>
</ul>

<h2>What we won’t scope in</h2>
<p>A few things we deliberately exclude from a first sprint:</p>
<ul>
<li><strong>Fine-tuning.</strong> It’s rarely necessary and adds weeks. Prompt engineering on a frontier model outperforms a fine-tuned smaller model on almost every task we’ve tried.</li>
<li><strong>A custom UI.</strong> The first sprint integrates into what you have. A new interface is a second sprint.</li>
<li><strong>Multiple workflows at once.</strong> One workflow, done well. The second sprint is cheaper because the infrastructure is already there.</li>
</ul>

<h2>How to start</h2>
<p>Send us two paragraphs: what the product does and which workflow you want to improve. We’ll come back within one business day with whether we think it’s a good first-sprint candidate and a rough scope. <a href="/contact.html">Start the conversation here.</a></p>


<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you’re looking to ship something like what’s described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
