---
title: "Rules Still Win: When Not to Use an LLM"
description: "LLMs aren't a silver bullet. We break down Dainty's decision tree for when deterministic rules outperform AI models."
category: "AI · Engineering"
publishedDate: "2026-06-08"
readTime: "5 min"
ogImage: "https://daintytrading.com/og-card.jpg"
---

<p>The core claim is simple: LLMs are the wrong tool for many tasks. Despite the hype, relying on a probabilistic model for deterministic requirements, tight latency budgets, or regulated outputs is a common misstep we see. A simple rule engine, a regex, or a database query often delivers better performance, reliability, and auditability. We've learned this building systems like <a href="https://daintytrading.com/projects/email-triage.html">Email Triage</a> and <a href="https://daintytrading.com/projects/ghost-writer.html">Ghost Writer</a>—knowing when to *not* use an LLM saves significant engineering time and prevents frustrating user experiences.</p>

<h2>The Temptation to LLM Everything</h2>
<p>Most teams, excited by recent advancements, immediately reach for an LLM when a new feature requires any kind of "intelligence." Need to extract a specific ID from a document? LLM. Classify user input into categories? LLM. Validate a structured data format? LLM. This approach seems reasonable because LLMs are incredibly flexible. They handle natural language gracefully and can adapt to varied inputs without explicit programming for every edge case. Developers often assume the LLM will "figure it out."</p>
<p>Where this breaks is predictable: cost, latency, and reliability. We've seen teams spend days trying to prompt-engineer an LLM to parse a simple, structured log file, only to find it occasionally hallucinates a field or fails to extract numerical data consistently. This is a probabilistic hammer trying to hit a deterministic nail. It adds unnecessary API costs, introduces unpredictable latency, and makes debugging a nightmare when the "AI" simply decides to be wrong.</p>

<h2>Dainty's Decision Tree: Rules vs. LLMs</h2>
<p>At Dainty, before we write a line of code for an AI-powered feature, we run through a decision tree. This helps us choose the right tool for the job. We use this framework for client projects and internal tools alike, whether it’s for <a href="https://daintytrading.com/projects/brightpath.html">BrightPath</a>’s user intent classification or <a href="https://daintytrading.com/projects/cv-matcher.html">CV Matcher</a>’s qualification logic.</p>
<ol>
<li><strong>Is the Output Deterministic?</strong>
<ul>
<li><strong>If YES: Use Rules.</strong> If the same input should *always* produce the exact same output, an LLM is overkill and unreliable. Examples: Validating an email address (regex), parsing a known JSON schema (Pydantic), calculating a discount based on fixed criteria (if/else logic), extracting a specific ID from a fixed-format string.</li>
<li><strong>If NO: Consider LLM.</strong> If the output can vary, requires creativity, or involves nuanced interpretation of unstructured data, an LLM is a good fit. Examples: Summarizing customer feedback, generating marketing copy, classifying sentiment in a free-form text review.</li>
</ul>
</li>
<li><strong>What is the Latency Budget?</strong>
<ul>
<li><strong>If TIGHT (sub-100ms): Use Rules.</strong> LLM API calls rarely hit this consistently. Even with caching and optimized models, network roundtrips and inference times add up. For real-time UI updates or critical path operations, rules are faster.</li>
<li><strong>If LOOSE (hundreds of ms or seconds): Consider LLM.</strong> If the user can wait, or the task runs asynchronously (e.g., background processing for <a href="https://daintytrading.com/projects/autoarchive-mail.html">AutoArchive Mail</a>), LLM latency is acceptable.</li>
</ul>
</li>
<li><strong>Are Outputs Regulated or Legally Binding?</strong>
<ul>
<li><strong>If YES: Use Rules (with human oversight).</strong> LLMs are probabilistic, prone to hallucination, and their reasoning is opaque. Generating legal documents, financial reports, or medical advice directly from an LLM without strict rule-based validation and human review introduces unacceptable risk.</li>
<li><strong>If NO: Consider LLM.</strong> If errors are acceptable (e.g., a slightly off tone in a draft email), an LLM can be used for generation, usually with guardrails.</li>
</ul>
</li>
<li><strong>What is the Cost of a Failure?</strong>
<ul>
<li><strong>If HIGH: Use Rules.</strong> If a wrong output leads to financial loss, data corruption, security vulnerabilities, or significant user frustration, deterministic rules provide a higher safety net.</li>
<li><strong>If LOW: Consider LLM.</strong> If a mistake is minor and easily recoverable (e.g., needing to re-generate a blog post draft), the probabilistic nature of an LLM is acceptable.</li>
</ul>
</li>
<li><strong>Is the Input Structured or Unstructured?</strong>
<ul>
<li><strong>If STRUCTURED/PREDICTABLE: Use Rules.</strong> If you can define a schema, a grammar, or a set of patterns, rules will be more reliable and efficient.</li>
<li><strong>If UNSTRUCTURED/VARIABLE: Consider LLM.</strong> Natural language, images, audio, or highly variable text formats are LLM strengths.</li>
</ul>
</li>
</ol>
<p>We often find the best solution is a hybrid. Rules serve as guardrails, pre-processors, and post-processors, while LLMs handle the truly fuzzy, complex parts. For example, <a href="https://daintytrading.com/projects/cv-matcher.html">CV Matcher</a> uses rules for hard requirements like "must have 5 years experience" and an LLM for nuanced skill matching.</p>

<h2>When Rules Themselves Become the Problem</h2>
<p>While we advocate for rules in specific scenarios, this approach isn't a panacea. There are times when a purely rule-based system becomes unmanageable. If your "deterministic" input actually has hundreds or thousands of subtle variations, manually crafting and maintaining a sprawling decision tree or an exhaustive set of regexes quickly becomes a nightmare. This is where the LLM's ability to generalize from examples shines; it can infer patterns without explicit programming for every permutation. We also see teams over-engineer rules for tasks that are inherently fuzzy, leading to brittle code that breaks with minor input changes. Sometimes, the initial development velocity of an LLM-based solution, even if less optimal in performance, makes more sense for a quick MVP. The key is recognizing when the complexity of your rules starts to outweigh the benefits of determinism.</p>

<h2>Apply the Decision Tree This Week</h2>
<p>For your next AI feature, pause before you import <code>openai</code> or <code>anthropic</code>. Take 30 minutes to map out the inputs and desired outputs. Ask yourself these questions:</p>
<ol>
<li>Can a simple Python function, regex, or database query produce this output reliably?</li>
<li>What's the absolute maximum acceptable latency for this feature?</li>
<li>What are the concrete consequences if this feature produces a wrong answer?</li>
</ol>
<p>If your answers point towards deterministic outputs, tight latency, or high costs of failure, start with a rule-based approach. For example, if you need to extract specific fields from a semi-structured document, try using Pydantic to define your schema and a simple parser first. Only if the input variability becomes unmanageable, or the task truly requires natural language understanding, should you bring in an LLM. This focused approach saves engineering cycles and delivers more robust systems. When you're ready to tackle these complex decisions and build production-grade AI, we’re here to help. <a href="https://daintytrading.com/contact.html">Start a project</a> with us.</p>

<div class="cast-philosophy" style="margin-top:40px;border-top:1px solid var(--border);padding-top:32px;">
<p><strong>We build production AI, not prototypes.</strong>
If you're looking to ship something like what's described here — see
<a href="/services.html">how we work</a> or
<a href="/contact.html">start a project brief →</a></p>
</div>
