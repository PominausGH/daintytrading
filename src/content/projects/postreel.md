---
type: "product"
status: "live"
name: "Post Reel"
title: "Post Reel — AI Video Social Media Scheduler | TelaLoom"
description: "Post Reel is a social media management platform with an AI video studio built in. Give it a URL, it crawls your site, writes a script, synthesises a voiceover, and produces a finished short-form video — scheduled automatically across 12 platforms."
ogTitle: "Post Reel — AI video generation meets social scheduling"
ogDescription: "Give it a URL, get a finished social video. Scheduler, AI video studio, campaign automation, and RSS autoposter across 12 platforms."
ogImage: "https://telaloom.com/og-card.jpg"
lede: "A social media management platform with an AI video studio built in. Give it a website URL, it crawls the site with a real browser, writes a narration script, synthesises a professional voiceover, and assembles a finished short-form video — then schedules it automatically across twelve platforms. No timeline. No editing. Just a URL."
metaChips:
  - label: "Category"
    value: "AI · Social media"
  - label: "Stack"
    value: "Next.js · Postgres · Prisma · BullMQ"
  - label: "AI"
    value: "Claude · ElevenLabs · Replicate"
  - label: "Status"
    value: "Live"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "Live"
    - label: "Site"
      value: "postreel.app"
    - label: "Frontend"
      value: "Next.js 16"
    - label: "Database"
      value: "Postgres · Prisma"
    - label: "Workers"
      value: "BullMQ on Redis"
    - label: "Browser automation"
      value: "Playwright"
    - label: "Video render"
      value: "FFmpeg"
    - label: "Voiceover"
      value: "ElevenLabs"
    - label: "AI video"
      value: "Replicate"
    - label: "LLM"
      value: "Claude (Anthropic)"
    - label: "Auth"
      value: "Auth.js v5"
    - label: "Billing"
      value: "Stripe (credit-based)"
    - label: "Platforms"
      value: "12 social networks"
  primaryCta:
    label: "Visit Post Reel →"
    href: "https://postreel.app"
  ghostCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "StoryPulse"
  href: "/projects/storypulse.html"
nextLink:
  label: "DevTodo"
  href: "/projects/devtodo.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>Most businesses know they should be posting on social media consistently. Almost none of them actually do it, because it takes real time — writing copy, resizing images, adapting the tone for each platform, remembering to schedule it, tracking what went out. Schedulers help with the last step but skip the hard part. The content still has to come from somewhere, and for small teams and solo operators it rarely does.</p>
<p>The video problem is even worse. Short-form video is where engagement is, but producing it properly requires a script, a voice, a visual, and a render pipeline. Most businesses either skip it entirely or outsource it at a cost that doesn’t make sense for weekly content.</p>

<h2>What we built</h2>
<p>Post Reel is a full social media scheduler that handles twelve platforms — Instagram, Facebook, LinkedIn, TikTok, YouTube, Threads, Pinterest, Google Business, X, Bluesky, and Mastodon — all connected via official OAuth in one dashboard. You write once, pick which platforms it goes to, and schedule it. The composer enforces per-platform character limits automatically and lets you write custom copy for individual platforms without touching the others if you need to. A content calendar shows everything laid out by date and lets you drag posts to reschedule them. Bulk import from CSV handles the backlog.</p>
<p>That’s the baseline. The part that makes Post Reel different is what happens when you hand it a URL.</p>

<h2>The AI video studio</h2>
<p>You paste in a URL — a homepage, a product page, a landing page, anything — and Post Reel fires up a real Playwright browser, crawls the site the way a human would, takes screenshots across multiple pages, and extracts the actual rendered content. Claude then writes a narration script from what it found. That script goes to ElevenLabs, which synthesises a professional voiceover with precise word-level timing so every word can be synced to a visual. FFmpeg assembles the whole thing into a 1080×1920 portrait video at 30fps — the format Instagram Reels, TikTok, and YouTube Shorts all expect.</p>
<p>There are three video styles to choose from. The screen recording style does an animated scroll through your actual website as the voiceover plays, so the viewer is watching your real pages as if someone is walking them through it. The slideshow style takes screenshots of multiple pages and sequences them with Ken Burns effects — slow pans and zooms that make static screenshots feel cinematic. The AI-generated style goes a different direction, sending a prompt to Replicate to produce original visuals that get looped and mixed with the voiceover, giving you something that looks more like a produced ad than a screen capture.</p>
<p>All three produce a finished MP4 ready to post. From there you can send it manually through the compose screen or let the system schedule it automatically as part of a campaign.</p>

<h2>Campaign automation</h2>
<p>Rather than creating videos one at a time, campaigns let you set a run going and walk away. You give it a website URL, tell it how many videos to produce and how many to post per week, pick a start date, and select which accounts to post to. Post Reel generates the full batch, works out AI-suggested optimal posting times based on region and platform, and schedules everything. A campaign of ten videos posting three times a week runs itself for a month. The campaign dashboard shows each video’s generation status in real time — queued, generating, ready, or failed — and tracks the posting schedule as it ticks down.</p>

<h2>RSS autoposter</h2>
<p>For businesses that publish content regularly, the RSS autoposter closes the loop between what you write and where it appears. Connect a blog feed or any RSS source, link it to your social accounts, and every time a new article lands in the feed Post Reel picks it up and queues a post. It tracks what’s already been sent so nothing goes twice.</p>

<h2>The rest of the platform</h2>
<p>The content library collects all drafts, published posts, and generated video assets in one place, with an Instagram grid preview so you can see exactly how your feed will look before anything goes live. Analytics tracks performance across all platforms — likes, impressions, comments, shares, reach — broken down by platform and over a selectable time range, with a per-post breakdown so you can see what actually landed. The composer has a built-in AI hashtag tool that reads the post content and suggests relevant tags.</p>
<p>Workspaces handle the agency use case. Each workspace has its own connected accounts, post history, campaigns, RSS feeds, and video credit balance. You switch between clients from a dropdown in the sidebar; nothing bleeds across. Video generation runs on a credit model: three credits on the free tier, then Starter ($29/month, 20 videos), Pro ($79/month, 100 videos), and Agency ($199/month, unlimited), billed through Stripe.</p>

<h2>How it’s being used</h2>
<p>The core use case is a business or agency that wants consistent short-form video presence without a dedicated content team. You connect your accounts, feed Post Reel your website, and it produces a month of content. You review it, schedule it, and get on with your day. The scheduler and calendar handle the ongoing cadence; campaigns handle bursts; RSS handles the content you’re already producing anyway.</p>

<h2>Where we are</h2>
<p>Scheduling across all twelve platforms, AI video generation across all three styles, campaign automation, RSS autoposter, the content calendar, and Stripe billing are all working. The platform is in final testing across a set of real accounts covering different industries to validate the video quality, scheduling reliability, and edge cases in the crawler before we open it up. The public launch is at <a href="https://postreel.app" rel="noopener" target="_blank">postreel.app</a>.</p>
