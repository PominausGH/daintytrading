---
title: "How to Keep Data Private When Using External LLM APIs"
description: "Send the model less data, strip identifiers before the call, and get retention terms in writing. A practical guide to LLM API privacy for engineering teams."
category: "Process"
publishedDate: "2026-10-03"
readTime: "6 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

You keep data private with external LLM APIs by sending less of it. Minimise the payload, redact identifiers before the call, control where the request goes, and get retention and training terms in writing. Contracts matter, but they are the last layer. The first layer is the code that builds the prompt.

Most teams do this in the wrong order. They read the provider's privacy page, feel fine, and ship. Then someone pastes a full customer record into a prompt because it was easier than choosing fields. This article covers the order we'd work in.

## The common wrong approach: trust the vendor, ignore the payload

The typical setup is an SDK call with whatever context is handy. The whole email thread. The whole CV. The whole support ticket, including the card number the customer typed by mistake.

It seems reasonable. The provider says API data isn't used for training by default, and you have a signed agreement. Both may be true. Neither fixes these problems:

- **Logs.** Your own request logging, error tracking and queue payloads now hold the sensitive text. Your vendor's retention policy doesn't cover your Sentry project.
- **Over-collection.** The model rarely needs the full record. You sent it anyway, so a breach or a retention mistake exposes all of it.
- **Prompt injection.** If the model can see data it doesn't need, a hostile document can try to make it repeat that data.
- **Silent drift.** Someone adds a field to the prompt six months later. Nobody re-reviews what leaves your network.

"We have a DPA" is a legal position. It isn't an engineering control.

## The better approach: four layers, in this order

**1. Minimise first.** Decide per task what the model actually needs. A classifier needs a subject line and the first few hundred characters, not the thread. Our CV Matcher makes one Claude Haiku call per CV and job pair. CV and job text are truncated to a fixed budget before the call. We did that for cost and predictability, but it also caps how much of any one document leaves the system. Fixed budgets are a privacy control as much as a cost control.

**2. Redact before the boundary.** Replace names, emails, phone numbers, account numbers and addresses with typed placeholders such as [PERSON_1] or [ACCOUNT_1]. Keep the mapping in your own database. Swap the real values back into the output after the model responds. Start with deterministic patterns for structured identifiers. Use an NER model, or a tool such as Microsoft Presidio, for free-text names. Test it on your own data. Redaction misses things, and a name in an unusual format is the usual miss.

**3. Control the route.** Put one function between your application and the provider. Everything leaving your network goes through it. That's where redaction runs, where you log metadata (token counts, model, latency) and not content, and where you block calls that carry fields you've disallowed. A hosted gateway or proxy such as LiteLLM can do this for you. Our own products call providers directly through a thin wrapper, which is enough at our size. Either way, you want a single choke point, not SDK calls scattered across the codebase.

Keep that choke point honest by treating prompts as reviewed artifacts. We wrote about [prompt versioning](https://daintytrading.com/blog/prompt-versioning-saves-ai-projects.html) for reliability, and it works for audit too. Email Triage keeps every prompt in one registry with a version date and a fingerprint, and publishes them on a public transparency page. If a prompt changes what it sends, the diff is visible.

**4. Paper it.** Now the contracts. Get these in writing: no training on your API data, retention period, whether zero-retention is available for your account, sub-processors, data residency, and breach notification terms. Read the terms for the specific endpoint you use. Consumer chat products and API products are not covered by the same policy. Check the current terms before each renewal, because they change.

## The cheapest option: don't use an LLM

Sometimes the right control is no model at all. We built AutoArchive Mail for a Big 4 Australian bank. It archives shared mailboxes on a schedule to storage the customer controls, keyed on message IDs and case IDs. It's Python and rule-based. It uses no AI or LLM at all. The job is deterministic and the data is sensitive, so rules were the safer and simpler fit. Before you design a redaction pipeline, ask whether the task needs a model.

## Where this breaks

Redaction destroys context. "Compare [PERSON_1]'s claim to [PERSON_2]'s" works. "Summarise this medical history" often doesn't, because the sensitive details are the content. In those cases you have three choices: a provider with zero-retention terms, a self-hosted open-weight model, or no model.

Self-hosting isn't free. You take on GPU costs, patching and capacity planning, and you usually give up some quality. For a small team it's often a worse security outcome than a well-configured API, because you've swapped a vendor risk for an operations risk.

Gateways add latency and a new component that holds your traffic. If it's compromised, you've concentrated the risk. And redaction mappings are themselves sensitive data. Store them with the same care as the originals, and expire them.

Retrieval adds its own question. If you embed sensitive documents, the vectors and the index are sensitive too. Our piece on [whether you need a vector database](https://telaloom.com/blog/do-you-need-a-vector-database.html) covers when that complexity is worth it.

## Practical next step this week

Audit what you actually send. Add a temporary log at your LLM call site that records field names and character counts, not values. Run it for a day. Then list every field and ask: does the model need this to do the task? Delete the ones it doesn't.

Next, check your own logs. Search Sentry, application logs and job queue payloads for text that came from prompts. Teams are often surprised by what they find there.

Finally, pull up your provider's current API data terms and note retention, training and sub-processor language in one page. If you want a second pair of eyes on a design that touches regulated data, [Start a project](https://telaloom.com/contact.html) with us and we'll review it with you.
