---
type: "product"
status: "testing"
name: "FakeCall"
title: "FakeCall — TelaLoom"
description: "Schedule a believable incoming call from anyone you want, with an AI on the other end having a real conversation. Useful for getting out of meetings, role-play training, or testing how a system handles unexpected calls."
ogTitle: "FakeCall"
ogDescription: "Schedule a believable incoming call from anyone you want, with an AI on the other end having a real conversation. Useful for getting out of meetings, role-play training, or testing how a system handles unexpected calls."
ogImage: "https://telaloom.com/og/fakecall.png"
lede: "Schedule a believable incoming call from anyone you want, with an AI on the other end having a real conversation. Useful for getting out of meetings, role-play training, or testing how a system handles unexpected calls."
metaChips:
  - label: "Category"
    value: "AI · Mobile"
  - label: "Stack"
    value: "Swift/SwiftUI · Kotlin/Jetpack Compose · CallKit"
  - label: "LLM"
    value: "Anthropic Claude"
  - label: "Status"
    value: "In final testing"
sidecard:
  heading: "Project facts"
  rows:
    - label: "Status"
      value: "In final testing"
    - label: "Site"
      value: "fakecall.telaloom.com"
    - label: "iOS"
      value: "Swift · SwiftUI · CallKit"
    - label: "Android"
      value: "Kotlin · Jetpack Compose"
    - label: "LLM"
      value: "Anthropic Claude (streaming)"
    - label: "Personas"
      value: "Configurable"
  primaryCta:
    label: "Build something similar"
    href: "/contact.html"
ctaBannerHeading: "Want to build something like this?"
ctaBannerBody: "We scope projects in 48 hours and ship a first demo in 1–2 weeks. Tell us what you need."
prevLink:
  label: "Auto-Claude"
  href: "/projects/auto-claude.html"
nextLink:
  label: "StoryPulse"
  href: "/projects/storypulse.html"
schemaType: "SoftwareApplication"
schemaExtra:
  applicationCategory: "BusinessApplication"
  operatingSystem: "Web"
  publisher:
    "@type": "Organization"
    name: "TelaLoom"
---

<h2>The problem</h2>
<p>“Fake call” apps have existed forever, but they all fall over at the same point: the user picks up and there’s nothing on the other end except an awkward pre-recorded clip or silence. The illusion holds for three seconds. We wanted to do this properly — a real conversation, scheduled or on-demand, that’s indistinguishable from a normal call.</p>

<h2>What we’re building</h2>
<p>FakeCall is a native iOS and Android app that uses CallKit on iOS to surface incoming calls in the system UI. When the user accepts, a streaming voice connection bridges them to a Claude-driven AI persona configured for the scenario — a partner running late, a client asking about a quote, a relative checking in. The persona has memory of prior calls and can reference earlier conversations.</p>

<h2>The AI angle</h2>
<p>Latency is the whole game. A realistic call is dead the moment you can hear the AI thinking. We use streaming Claude responses paired with low-latency TTS, plus barge-in handling so the user can interrupt the AI mid-sentence the way you would a real caller.</p>

<h2>How it’ll be used</h2>
<ul><li><strong>Anyone in an awkward meeting</strong> who needs a believable exit.</li><li><strong>Sales teams</strong> rehearsing tough call scenarios with a non-flinching counterpart.</li><li><strong>QA teams</strong> stress-testing telephony workflows with realistic conversational input.</li></ul>

<h2>Where we are</h2>
<p>iOS build with CallKit integration is working in TestFlight. Latency budget hits the conversational target on most networks. Android build is in development. Public launch waits for the persona library to be more polished — right now it’s 8 well-tuned scenarios, we want 20.</p>

<h2>Why CallKit instead of a plain in-app call screen</h2>
<p>An in-app “incoming call” screen is the easy build, and it’s also the reason most fake-call apps don’t hold up — the illusion depends on the phone behaving exactly like it does for a real call, and a screen inside an app can’t do that. CallKit puts the call on the actual lock screen, with the actual system ringtone and answer/decline UI, so it looks identical to any other incoming call to anyone glancing at the phone. The cost is that CallKit imposes real constraints — strict rules on when an app is allowed to report an incoming call, and no equivalent API on Android, which is why the two platforms aren’t on the same timeline.</p>
<p>The persona count is deliberately capped for now rather than opened up. Each scenario needs its own tuning pass on tone, pacing, and what the AI does and doesn’t know, and a persona that breaks character under an unexpected question is worse than no persona at all — it turns a believable call into an obviously fake one at the exact moment the user needed it most.</p>
