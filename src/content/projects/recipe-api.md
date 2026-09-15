---
type: "product"
status: "dev"
name: "Recipe API"
title: "Recipe API — Django REST Backend for Recipes | Dainty Trading"
description: "Recipe API is a clean Django REST Framework backend for recipes and ingredients with filtering, pagination, and authentication. The reference backend for any recipe front-end you want to build."
ogTitle: "Recipe API"
ogDescription: "Django REST API for recipes and ingredients."
ogImage: "https://daintytrading.com/og/recipe-api.png"
lede: "A clean, well-tested Django REST Framework backend for recipes and ingredients. Filtering, pagination, token auth, an OpenAPI schema, and a docker-compose that brings the whole thing up in one command."
metaChips:
  - label: "Category"
    value: "API · Backend"
  - label: "Stack"
    value: "Python · Django · DRF · Postgres"
  - label: "Status"
    value: "In development"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In development"
    - label: "Domain"
      value: "recipe.daintytrading.com"
    - label: "Backend"
      value: "Python · Django · DRF"
    - label: "Database"
      value: "Postgres"
    - label: "Tests"
      value: "Pytest · CI-gated"
    - label: "Schema"
      value: "OpenAPI"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Billing API"
  href: "/projects/billing-api.html"
nextLink:
  label: "Screenshot to Text"
  href: "/projects/screenshot-to-text.html"
schemaType: "WebAPI"
schemaExtra:
  provider:
    "@type": "Organization"
    name: "Dainty Trading"
---

<h2>The problem</h2>
<p>Most recipe-app starters cut corners somewhere — auth is stubbed, tests are absent, the docker setup doesn’t survive a fresh clone. We wanted a reference backend that did all the boring things right, so a front-end team could plug in and ship a real product without rebuilding the API layer.</p>

<h2>What we built</h2>
<p>Recipe API is a Django REST Framework service for recipes, ingredients, tags, and users. It supports CRUD with filtering and pagination, uploads recipe images, and has a complete test suite that runs on a fresh clone with one command. Postgres is the source of truth; Docker brings up the API, the database, and a development-ready environment.</p>

<h2>The automation angle</h2>
<p>The interesting thing here isn’t the AI — it’s the testing discipline. Every endpoint has its happy path covered, every permission rule is asserted in tests, and the CI pipeline blocks merges that drop coverage. The lesson generalises: a backend built like this can absorb new features for years without rotting.</p>
<p>The API also models the social layer a recipe product actually needs — following other users, rating recipes, commenting, and a personalised activity feed built from who you follow — not just the recipes-and-ingredients CRUD the name suggests. A companion React/TypeScript frontend exists to exercise it end to end, which is what forces the permission model to be honest: a “follow” relationship, a rating that belongs to exactly one user, a feed query that has to stay fast as the follow graph grows, all have to work through the same auth layer a real client depends on, not just through a test client that assumes the happy path.</p>
<p>GitHub Actions runs the suite on every push, which is what makes the coverage gate mean something — a test suite nobody runs automatically decays into documentation nobody trusts. Docker Compose brings up the API, Postgres, and the frontend together, so “does this actually work” is one command rather than a checklist of services to start in the right order.</p>

<h2>How it’s used</h2>
<ul>
<li><strong>Front-end teams</strong> looking for a stable API to build against.</li>
<li><strong>Reference architecture</strong> for any of our other Django services.</li>
<li><strong>Teaching surface</strong> for engineers learning DRF properly.</li>
</ul>

<h2>What it taught us</h2>
<p>That a small, opinionated, well-tested API is a kind of capital. Recipe API is the boring service we lean on when we need a reminder of what good Django looks like.</p>
