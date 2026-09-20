const express = require('express');
const { requireAdmin } = require('../lib/auth');
const { sanitize, escapeHtml } = require('../lib/security');
const { sendEmail } = require('../lib/email');
const store = require('../lib/prospects-store');
const config = require('../lib/config');

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

router.get('/:slug/draft', async (req, res) => {
  const { run } = req.query;
  const { slug } = req.params;
  if (!store.isValidName(run) || !store.isValidName(slug)) {
    return res.status(400).json({ error: 'Invalid "run" or "slug" parameter' });
  }
  let draft;
  try {
    draft = await store.buildDraft(run, slug);
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

  const { to, subject, body, variant } = req.body || {};
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
  if (store.isSuppressed(domain, to.trim())) {
    return res.status(409).json({ error: 'This domain or address is on the suppression list.' });
  }
  const sentThisWeek = store.countSentInLastDays(7);
  if (sentThisWeek >= config.prospectsRateLimitPerWeek) {
    return res.status(429).json({ error: `Weekly send limit reached (${config.prospectsRateLimitPerWeek}/week).` });
  }

  const cleanSubject = sanitize(subject);
  const html = textToHtml(body) + footerHtml();
  const replyTo = process.env.CONTACT_NOTIFICATION_EMAIL || process.env.FROM_EMAIL || undefined;

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

  const record = store.markSent(run, slug, { to: to.trim(), subject: cleanSubject, domain, variant: variant || null });
  res.json({ success: true, sent: record });
});

module.exports = router;
