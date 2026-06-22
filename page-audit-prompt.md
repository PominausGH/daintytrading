# Page Audit Prompt — Dainty Trading

Use this prompt to audit any page on daintytrading.com. Paste the full HTML or visible text of the page, then ask Claude to run the audit below.

---

## Prompt

You are a conversion copywriter and UX analyst specialising in B2B services and AI software agencies. Your job is to reduce bounce rate and increase qualified enquiries from the page below.

Audit the page across four dimensions. For each finding, give:
- **What's wrong** (specific quote or element)
- **Why it hurts** (how it triggers a bounce or kills trust)
- **Fix** (exact rewritten copy or structural change)

---

### 1. WORDING — Does the copy make a visitor feel understood in the first 5 seconds?

Check for:
- [ ] **Hero clarity** — Does the headline name a specific pain or outcome, not just what the company is?
- [ ] **Audience signal** — Does the visitor know this is for them (SaaS founder / CTO / operator) within 3 lines?
- [ ] **Jargon balance** — Is tech stack language used to build credibility, or is it being used where it alienates non-technical buyers?
- [ ] **Social proof language** — Are claims backed by outcomes (hours saved, revenue generated, clients helped) or just features?
- [ ] **Urgency/trust anchors** — Are differentiators ("no retainer", "demo in 2 weeks") prominent or buried?
- [ ] **Australian/locale tone** — Is the spelling and tone appropriate for the target geographic audience of this page?
- [ ] **Call to action verbs** — Are CTAs action-outcome framed ("Get your first demo") not just generic ("Contact us")?

---

### 2. FORMAT — Does the layout hold attention through the scroll?

Check for:
- [ ] **Above-the-fold proof** — Is there at least one trust signal (testimonial, outcome stat, client name) visible without scrolling?
- [ ] **Decision paralysis** — If there are more than 6 items in a list or grid, is there a progressive disclosure mechanism (tabs, "see more" button)?
- [ ] **Persistent CTA** — On a long-scroll page, does the CTA appear every 2–3 screen-heights so the reader always has a next step?
- [ ] **Section order** — Is the sequence: Pain → Solution → Proof → How it works → CTA? Or is it out of order?
- [ ] **White space and readability** — Are there walls of text that should be broken into bullets or short paragraphs?
- [ ] **Visual hierarchy** — Does every section have one clear heading that tells skimmers what they need to know?
- [ ] **Mobile scan** — Would a skimmer on mobile understand the value prop from headings alone?

---

### 3. SEO — Is this page findable for the right queries?

Check for:
- [ ] **Title tag** — Does it lead with the target keyphrase, not the brand name?
- [ ] **Meta description** — Does it read like ad copy (compelling, with a differentiator) not a summary?
- [ ] **H1 uniqueness** — Is the H1 different from the title tag and does it target a secondary keyword?
- [ ] **Internal links** — Does the page link to the 2–3 most relevant deep pages (services, specific projects) with descriptive anchor text?
- [ ] **Keyword density** — Are target phrases (e.g. "AI development agency Australia", "LLM automation") used naturally in the first 100 words?
- [ ] **Image alt text** — Do images (screenshots, OG card) have descriptive alt text with keywords?

---

### 4. GEO (Generative Engine Optimisation) — Will AI search engines surface this page accurately?

Check for:
- [ ] **Entity clarity** — Is it immediately obvious WHO this is (company name, location, what they do) in the first paragraph of visible text?
- [ ] **FAQ coverage** — Does the page answer the 3–5 questions a prospect would ask an AI assistant about this service/product?
- [ ] **Outcome specificity** — Are there concrete numbers (timelines, counts, percentages) that AI engines can cite directly?
- [ ] **Structured data** — Is there JSON-LD for the relevant schema type (Organization, Service, FAQPage, Product)?
- [ ] **`areaServed` accuracy** — Does the schema accurately reflect the geographic focus of this specific page (AU, UK, US, or global)?
- [ ] **llms.txt alignment** — Does the key information on this page match what's in /llms.txt so AI crawlers get a consistent answer?
- [ ] **Quotable sentences** — Are there 2–3 short, declarative sentences per section that an AI could lift verbatim as a cited answer?

---

### Output format

Return findings as a prioritised list:

**Priority 1 — Fix today** (highest bounce/trust impact)
**Priority 2 — Fix this week** (SEO and GEO improvements)
**Priority 3 — Test next sprint** (A/B candidates)

End with a rewritten version of the hero section (headline + lead paragraph + CTA) incorporating all Priority 1 fixes.

---

*Paste the page content below this line, then send.*
