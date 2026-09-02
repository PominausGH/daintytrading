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

// Converts the plain-text, edited-by-a-human body into simple HTML for sendEmail() —
// escape first, then turn blank-line-separated paragraphs into <p> and single
// newlines into <br>, deliberately with no styling/template so it doesn't read as
// a marketing email.
function textToHtml(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => '<p>' + escapeHtml(para).replace(/\n/g, '<br>') + '</p>')
    .join('\n');
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
  if (!config.prospectsFooterAddress) {
    return res.status(500).json({ error: 'PROSPECTS_FOOTER_ADDRESS is not configured — refusing to send a commercial email without a compliant footer (Spam Act 2003).' });
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

  const result = await sendEmail({ to: to.trim(), subject: cleanSubject, html, replyTo });
  if (!result.success) {
    return res.status(502).json({ error: result.error || 'Failed to send email' });
  }

  const record = store.markSent(run, slug, { to: to.trim(), subject: cleanSubject, domain, variant: variant || null });
  res.json({ success: true, sent: record });
});

module.exports = router;
