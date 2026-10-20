const express = require('express');
const { requireAdmin } = require('../lib/auth');
const { sanitize, escapeHtml } = require('../lib/security');
const { sendEmail } = require('../lib/email');
const store = require('../lib/prospects-store');
const config = require('../lib/config');
const { createProspectSiteCheck } = require('../lib/prospects-sitecheck');
const siteCheckRouter = require('./site-check');

// Drafts ask our own site checker about the prospect's site, through the same live service the
// public checker uses (shared 24h cache and in-flight checks).
store.setSiteCheck(createProspectSiteCheck({ checkDomain: (host) => siteCheckRouter.service.checkOnly(host) }));

const router = express.Router();

// Same gate as admin.js — mounted directly under /api/admin, so every route here
// requires a valid admin session. There are no public routes in this file.
router.use(requireAdmin);

router.get('/runs', (req, res) => {
  res.json({ runs: store.listRuns() });
});

router.get('/', (req, res) => {
  const { run } = req.query;
  if (!store.isValidName(run)) {
    return res.status(400).json({ error: 'Invalid or missing "run" parameter' });
  }
  const prospects = store.getRunProspects(run);
  if (prospects === null) return res.status(404).json({ error: 'Run not found' });
  res.json({ run, prospects });
});

// What still needs a second email, and how the outreach is going overall.
router.get('/follow-ups', (req, res) => {
  res.json({ followUps: store.listFollowUps(), stats: store.outreachStats() });
});

// Every email that can go today, drafted, across all runs (one per business, latest run wins),
// plus counts and the weekly allowance. Never a model call.
router.get('/queue', (req, res) => {
  res.json(store.buildQueue());
});

// Writes drafts for every emailable prospect that doesn't have one yet, in the background: one
// model call at a time, ~30s each, far past nginx's 10s. Answers straight away; the dashboard
// polls GET /predraft (or the queue) for progress. One run at a time, shared with the cron script
// (scripts/predraft-prospects.js) through a lock file.
router.get('/predraft', (req, res) => {
  res.json(store.predraftStatus());
});

router.post('/predraft', (req, res) => {
  const status = store.predraftStatus();
  if (status.running) return res.status(409).json({ error: 'Drafting is already running.', ...status });
  const run = store.predraftAll();
  run.then(
    (summary) => {
      if (summary.started) console.log(`prospects: pre-draft done: ${summary.drafted} drafted, ${summary.flagged} flagged, ${summary.noFinding} no finding, ${summary.checking} still checking, ${summary.errors} errors`);
    },
    (err) => console.error('prospects: pre-draft failed:', err.message)
  );
  // predraftAll takes the lock and counts its work before its first await, so this is its run.
  res.status(202).json({ started: true, ...store.predraftStatus() });
});

function validRunSlug(req, res) {
  const { run } = req.query;
  const { slug } = req.params;
  if (!store.isValidName(run) || !store.isValidName(slug)) {
    res.status(400).json({ error: 'Invalid "run" or "slug" parameter' });
    return null;
  }
  return { run, slug };
}

// The follow-up draft for a prospect, or why there isn't one (not due yet, replied, opted out,
// already sent). Never a model call.
router.get('/:slug/follow-up', (req, res) => {
  const ids = validRunSlug(req, res);
  if (!ids) return;
  res.json(store.buildFollowUp(ids.run, ids.slug));
});

// Replies land in our own inbox, so a person records them here. `replied: false` undoes a slip.
router.post('/:slug/replied', (req, res) => {
  const ids = validRunSlug(req, res);
  if (!ids) return;
  const record = store.markReplied(ids.run, ids.slug, !(req.body && req.body.replied === false));
  if (!record) return res.status(404).json({ error: 'No email has been sent to this prospect.' });
  res.json({ success: true, replied: !!record.repliedAt });
});

// "Don't email me again": suppresses the address we wrote to and the business's website.
router.post('/:slug/opt-out', (req, res) => {
  const ids = validRunSlug(req, res);
  if (!ids) return;
  const result = store.optOut(ids.run, ids.slug);
  if (!result) return res.status(404).json({ error: 'No email has been sent to this prospect.' });
  res.json({ success: true, suppressed: result.suppressed });
});

// "Not this one, not now": takes the prospect out of the send queue. Unlike an opt-out it doesn't
// suppress the business. `skipped: false` puts it back.
router.post('/:slug/skip', (req, res) => {
  const ids = validRunSlug(req, res);
  if (!ids) return;
  if (!store.prospectExists(ids.run, ids.slug)) return res.status(404).json({ error: 'Prospect not found' });
  const skipped = !(req.body && req.body.skipped === false);
  const record = store.setSkipped(ids.run, ids.slug, skipped);
  res.json({ success: true, skipped, skippedAt: record ? record.skippedAt : null });
});

router.get('/:slug/draft', async (req, res) => {
  const { run } = req.query;
  const { slug } = req.params;
  if (!store.isValidName(run) || !store.isValidName(slug)) {
    return res.status(400).json({ error: 'Invalid "run" or "slug" parameter' });
  }
  let draft;
  try {
    // fresh=1 is the dashboard's Regenerate button; without it a saved draft is returned as is.
    draft = await store.buildDraft(run, slug, { fresh: req.query.fresh === '1' });
  } catch (err) {
    return res.status(502).json({ error: `Drafting failed: ${err.message}` });
  }
  if (!draft) return res.status(404).json({ error: 'Prospect not found' });
  res.json(draft);
});

// Turns a bare https:// URL into a real clickable link — run AFTER escaping, on already-
// escaped text (URLs don't contain &/</>, so escaping never corrupts a match). A hoverable
// link the recipient can check against the claimed domain is a genuine anti-phishing signal;
// leaving the signature's URL as inert text undercuts the whole point of including it.
function linkifyUrls(escapedText) {
  return escapedText.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const trailing = url.match(/[).,!?]+$/);
    const clean = trailing ? url.slice(0, -trailing[0].length) : url;
    const suffix = trailing ? trailing[0] : '';
    return `<a href="${clean}">${clean}</a>${suffix}`;
  });
}

// Converts the plain-text, edited-by-a-human body into simple HTML for sendEmail() —
// escape first, then linkify URLs, then turn blank-line-separated paragraphs into <p> and
// single newlines into <br>. Wrapped in a font/line-height/spacing container so it reads
// like a normal person's email client output (readable font, real paragraph gaps) rather
// than un-styled <p> tags stacked with each client's inconsistent default margins — but
// deliberately no logo/banner/colour-block/button, since that's what reads as a marketing
// template (and testing showed *that* combination is what triggered a spam/phishing read,
// not plain text itself).
function textToHtml(text) {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((para) => '<p style="margin:0 0 14px 0;">' + linkifyUrls(escapeHtml(para)).replace(/\n/g, '<br>') + '</p>')
    .join('\n');
  return (
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;' +
    'font-size:15px;line-height:1.5;color:#222;">' +
    paragraphs +
    '</div>'
  );
}

// Spam Act 2003 requires a genuine contact address in every commercial electronic message,
// plus a functional unsubscribe facility. There's no inbound-email pipeline on this host to
// action an "unsubscribe" reply automatically — until one exists, a reply has to be added to
// data/prospects-suppression.json by hand. Said so plainly in the footer rather than promising
// automation that doesn't exist.
function footerHtml() {
  return (
    '<p style="color:#888;font-size:12px;margin-top:24px;">' +
    escapeHtml(config.prospectsFooterAddress) +
    '<br>Don\'t want to hear from us again? Reply "unsubscribe" and we\'ll stop.' +
    '</p>'
  );
}

router.post('/:slug/send', async (req, res) => {
  const { run } = req.query;
  const { slug } = req.params;
  if (!store.isValidName(run) || !store.isValidName(slug)) {
    return res.status(400).json({ error: 'Invalid "run" or "slug" parameter' });
  }
  if (!store.prospectExists(run, slug)) {
    return res.status(404).json({ error: 'Prospect not found' });
  }

  const { to, subject, body, variant, followUp, fromQueue } = req.body || {};
  if (!to || typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    return res.status(400).json({ error: 'A valid "to" email address is required' });
  }
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return res.status(400).json({ error: 'Subject is required' });
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Body is required' });
  }

  const domain = (to.trim().split('@')[1] || '').toLowerCase() || null;
  const siteDomain = store.siteDomainFor(run, slug);
  if (store.isSuppressed(domain, to.trim(), siteDomain)) {
    return res.status(409).json({ error: 'This domain or address is on the suppression list.' });
  }
  // A follow-up only goes when it is due: first email sent, the wait is over, and they haven't
  // replied, opted out or already had one. Checked here, not just in the dashboard.
  if (followUp) {
    const state = store.followUpState(store.getSentRecord(run, slug));
    if (state !== 'due') {
      return res.status(409).json({ error: store.buildFollowUp(run, slug).reason || 'A follow-up is not due for this prospect.' });
    }
  }
  // A first email from the send queue is re-checked here (already sent, cooldown, two-email
  // limit), so a double click or a page left open can't email a business twice.
  if (fromQueue && !followUp) {
    const blocked = store.firstEmailBlockReason(run, slug);
    if (blocked) return res.status(409).json({ error: blocked });
  }
  const sentThisWeek = store.countSentInLastDays(7);
  if (sentThisWeek >= config.prospectsRateLimitPerWeek) {
    return res.status(429).json({ error: `Weekly send limit reached (${config.prospectsRateLimitPerWeek}/week).` });
  }

  const cleanSubject = sanitize(subject);
  const html = textToHtml(body) + footerHtml();
  // Replies go to the address the email comes from (hello@telaloom.com). Cloudflare routes that
  // through the reply-router worker, which forwards to the inbox and auto-actions opt-outs and
  // replies (POST /api/inbound-reply). CONTACT_NOTIFICATION_EMAIL is still the internal-alert
  // address (old-brand hello@daintytrading.com), which the router doesn't watch.
  const replyTo = config.prospectsFromEmail;

  const result = await sendEmail({
    to: to.trim(),
    subject: cleanSubject,
    html,
    replyTo,
    from: config.prospectsFromEmail,
    fromName: config.prospectsFromName,
  });
  if (!result.success) {
    return res.status(502).json({ error: result.error || 'Failed to send email' });
  }

  const record = followUp
    ? store.markFollowUpSent(run, slug, { subject: cleanSubject })
    : store.markSent(run, slug, { to: to.trim(), subject: cleanSubject, domain, siteDomain, variant: variant || null });
  res.json({ success: true, sent: record, followUp: !!followUp });
});

// A message Andrew pasted into the business's own contact form, by hand. Nothing is sent from
// here (we never submit other sites' forms automatically): this records it so it counts toward
// the weekly cap, gets the follow-up reminder, and obeys the same suppression, cooldown and
// two-message rules as an email.
router.post('/:slug/sent-via-form', (req, res) => {
  const { run } = req.query;
  const { slug } = req.params;
  if (!store.isValidName(run) || !store.isValidName(slug)) {
    return res.status(400).json({ error: 'Invalid "run" or "slug" parameter' });
  }
  if (!store.prospectExists(run, slug)) {
    return res.status(404).json({ error: 'Prospect not found' });
  }
  const { subject, variant, followUp, formUrl } = req.body || {};
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  const siteDomain = store.siteDomainFor(run, slug);
  if (store.isSuppressed(siteDomain)) {
    return res.status(409).json({ error: 'This business is on the suppression list.' });
  }
  if (followUp) {
    const state = store.followUpState(store.getSentRecord(run, slug));
    if (state !== 'due') {
      return res.status(409).json({ error: store.buildFollowUp(run, slug).reason || 'A follow-up is not due for this prospect.' });
    }
  } else {
    const blocked = store.firstEmailBlockReason(run, slug);
    if (blocked) return res.status(409).json({ error: blocked });
  }
  if (store.countSentInLastDays(7) >= config.prospectsRateLimitPerWeek) {
    return res.status(429).json({ error: `Weekly send limit reached (${config.prospectsRateLimitPerWeek}/week).` });
  }

  const cleanSubject = sanitize(subject);
  const cleanFormUrl = typeof formUrl === 'string' && /^https?:\/\//i.test(formUrl.trim()) ? formUrl.trim() : null;
  const record = followUp
    ? store.markFollowUpSent(run, slug, { subject: cleanSubject })
    : store.markSent(run, slug, {
      to: null, subject: cleanSubject, domain: null, siteDomain, variant: variant || null, channel: 'form', formUrl: cleanFormUrl,
    });
  res.json({ success: true, sent: record, followUp: !!followUp });
});

module.exports = router;
