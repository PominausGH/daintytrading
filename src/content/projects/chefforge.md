---
type: "product"
status: "dev"
name: "ChefForge"
title: "ChefForge — AI Recipe Generation & Meal Planning | Dainty Trading"
description: "ChefForge generates personalised recipes and weekly meal plans with AI. Tell it your constraints — dietary, budget, time, what's already in the fridge — and get a plan that adds up."
ogTitle: "ChefForge — AI recipe generation"
ogDescription: "Personalised recipes and meal plans with constraints that actually hold."
ogImage: "https://daintytrading.com/og/chefforge.png"
lede: "An AI recipe and meal-planning service that takes your real constraints — dietary, budget, time, what’s already in the fridge — and turns them into a week of dinners with a shopping list that actually adds up."
metaChips:
  - label: "Category"
    value: "AI · Lifestyle"
  - label: "Stack"
    value: "Python · FastAPI · Postgres"
  - label: "LLM"
    value: "OpenRouter"
  - label: "Status"
    value: "In development"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Domain"
      value: "dinner.daintytrading.com"
    - label: "Backend"
      value: "Python · FastAPI"
    - label: "Database"
      value: "Postgres"
    - label: "Routing"
      value: "OpenRouter"
    - label: "Outputs"
      value: "Plan · Recipes · Shopping list"
  primaryCta:
    label: "Visit ChefForge →"
    href: "https://dinner.daintytrading.com"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "DevTodo"
  href: "/projects/devtodo.html"
nextLink:
  label: "Yoga Platform"
  href: "/projects/yoga-platform.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "LifestyleApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>The first wave of AI recipe apps generated impressive-looking dishes that nobody could actually cook. Either the ingredients didn’t exist in your supermarket, the steps assumed equipment you didn’t have, or the macros didn’t add up to the diet you said you were on. We wanted a system that took constraints seriously and let the AI freelance only inside them.</p>

<h2>What we built</h2>
<p>ChefForge is a FastAPI backend with a clean recipe-and-plan schema. Users describe their household once — how many people, dietary restrictions, equipment, weekly budget, ingredients to avoid, ingredients to use up — and ChefForge plans a week of dinners that hit all the constraints. Each recipe is independently solvable: rendered with portion-scaled quantities, total cost, total time, and macros that sum back to the user’s daily budget.</p>

<h2>The AI angle</h2>
<p>Generation happens in two passes. The first asks for a balanced weekly outline. The second expands each slot into a full recipe and verifies that the resulting plan still sums to the user’s constraints — if it doesn’t, the LLM is told exactly what’s wrong and asked to revise. The verifier is deterministic code, not another LLM call, which is why ChefForge stays tight even when the underlying model gets creative.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Busy households</strong> who want one less weekly decision.</li>
<li><strong>People on specific eating regimes</strong> — high-protein, gluten-free, low-FODMAP — who can’t trust generic recipe sites.</li>
<li><strong>Cooking-curious beginners</strong> who need pacing, not inspiration.</li>
</ul>

<h2>What it taught us</h2>
<p>That “the AI got it wrong” usually means the verifier was missing. Ninety percent of complaints traced back to a constraint we hadn’t encoded as a hard check. The fix isn’t a smarter prompt — it’s another check.</p>

<h2>Why generation happens in two passes, not one</h2>
<p>Asking a model for a full week of meals in a single call sounds simpler, but it’s the wrong shape for the problem: a full plan has too many constraints in flight at once for the model to hold consistently, so the failures show up as a fine-looking Tuesday that quietly blows the week’s budget by Friday. Splitting outline from detail means each pass only has to get one thing right — a balanced week of meal slots, then a recipe that fits the slot it was given — and the deterministic verifier between the two passes is what actually catches drift, not a better prompt. It also means a single bad recipe can be regenerated on its own without throwing out a week that was otherwise fine.</p>
