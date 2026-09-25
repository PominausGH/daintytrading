---
title: "How to Get Buy-In for Your First AI Automation Project"
description: "Pick a boring, reversible process, baseline it before you build, and promise less than you expect to deliver. That's how you win internal buy-in for AI."
category: "Process"
publishedDate: "2026-09-26"
readTime: "5 min"
ogImage: "https://telaloom.com/og-card.jpg"
---

You get buy-in for a first AI automation project by proposing a small, boring, reversible process, measuring it before you build anything, and promising less than you expect to deliver. Leadership doesn't say yes to "AI." It says yes to a named process, a baseline number, a capped downside, and a date on which you'll report results.

Most first pitches fail because they lead with the technology. The rest fail because they lead with a transformation story nobody can check. Below: how to pick the process, how to build the ROI case, and how to keep expectations honest.

## The pitch that stalls

The usual first pitch is a vision deck. "AI-enabled operations." A slide on productivity gains from an analyst report. A demo that worked on three hand-picked examples.

It feels persuasive. It breaks in the first meeting, because the skeptical person in the room asks three questions the deck can't answer. What exactly does this replace? What happens when it's wrong? How will we know it worked?

A second failure follows from the first. The team picks the most impressive process instead of the most suitable one: customer-facing, high-stakes, loosely defined. Then the first visible mistake lands in front of a customer, and the whole programme gets frozen. One bad output in a high-visibility spot costs you more credibility than ten good outputs in a back-office queue earn you.

## Pick the process, then earn the argument

Screen candidates on four properties:

- **Frequent.** It happens daily or hourly, so you get a real sample quickly.
- **Internal.** A wrong output reaches a colleague, not a customer.
- **Reversible.** A human can undo or override any result.
- **Checkable.** You can say what "correct" looks like without a debate.

Sorting, scoring, extraction and first-draft work fit well. We wrote about why [the boring step beats the impressive one](https://daintytrading.com/blog/automate-the-boring-step-first.html), and that argument carries extra weight in a buy-in conversation. The boring step is the one your sceptics can inspect.

Design the failure path before you present. Our own small products show the pattern. CV Matcher makes one model call per CV and job pair, requires fixed JSON back, and falls back to a deterministic keyword score if the call fails or the output doesn't parse. BrightPath's AI tutor answers with a pre-written fallback if the model call fails, and it's rate-limited per hour and per child per day. Neither is clever. Both let us tell a nervous stakeholder exactly what happens on the worst day. You should be able to say the same.

## Build the ROI case from a baseline, not a forecast

Before you write any code, measure the current process for a week or two. You need four numbers:

- Volume: items per week.
- Handling time: minutes per item, from a sample, not a guess.
- Error or rework rate: how often a human currently gets it wrong or redoes it.
- Loaded cost of the people doing it.

The case is then arithmetic: volume × minutes saved × loaded cost, minus model spend and review time. Add the review time. Everyone forgets it, and finance won't. If a human still checks every output, your savings are the difference between checking and doing, not the whole task.

Then set a pass mark before you start. "If the automation matches human decisions on our sample at an agreed rate, we expand. If not, we stop." Agree the number with the sceptic, not for them. A kill criterion makes yes easy, because the risk is capped and visible.

Keep the scope written down too. Vague scope is where budgets blow up, and we covered how to [scope AI projects so they don't run away](https://daintytrading.com/blog/scope-ai-projects-avoid-blowout.html).

## Manage expectations in writing

Tell leadership three things up front. First, the first version will be wrong sometimes, and a human stays in the loop. Second, the win is measured against the baseline, not against perfection. Third, you will report on a fixed date whether or not the result is flattering.

Then run in shadow mode first. The system produces outputs, humans keep doing the work, and you compare. Shadow mode turns a debate about opinions into a table of results. It's also the cheapest way to find the edge cases you didn't predict.

## Where this breaks

The baseline-first approach is slow when the process has no data. If nobody logs handling time, you'll spend your first weeks instrumenting instead of automating. That's still worth it, but say so, or people will read it as a stall.

Some processes fail the screen and are still politically urgent, such as a customer-facing request from an executive. Don't fight it head on. Offer a narrower internal version first and let the results argue for the bigger one.

Sometimes the honest answer is that AI is the wrong tool. If the rules are fixed and auditable, rules win. AutoArchive Mail, which we built for a Big 4 Australian bank, uses no AI at all. It's rule-based, and that was the right call. Saying "this one doesn't need a model" also buys you credibility for the ones that do.

Finally, small numbers can be too small. If the baseline savings don't cover the build and review cost, don't pitch it. Pick another process.

## Your next step this week

Write a one-page brief for a single process. Name it, give the four baseline numbers (measured, or flagged as estimates), state the worst-case failure and its fallback, and set the pass mark. Send it to the one person most likely to object, and ask what would make them say no.

If you'd rather pressure-test the candidate with someone who has done this before, that's a natural fit for our [discovery week](https://daintytrading.com/blog/discovery-week-ai-automation-partner.html), and you can [Start a project](https://telaloom.com/contact.html) with us when you're ready to scope it.
