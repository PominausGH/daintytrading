const express = require('express');
const { requireAdmin } = require('../lib/auth');
const { sanitize, escapeHtml } = require('../lib/security');
const { sendEmail } = require('../lib/email');
const store = require('../lib/prospects-store');

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

router.get('/:slug/draft', (req, res) => {
  const { run } = req.query;
  const { slug } = req.params;
  if (!store.isValidName(run) || !store.isValidName(slug)) {
    return res.status(400).json({ error: 'Invalid "run" or "slug" parameter' });
  }
  const draft = store.buildDraft(run, slug);
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

router.post('/:slug/send', async (req, res) => {
  const { run } = req.query;
  const { slug } = req.params;
  if (!store.isValidName(run) || !store.isValidName(slug)) {
    return res.status(400).json({ error: 'Invalid "run" or "slug" parameter' });
  }
  if (!store.prospectExists(run, slug)) {
    return res.status(404).json({ error: 'Prospect not found' });
  }

  const { to, subject, body } = req.body || {};
  if (!to || typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
    return res.status(400).json({ error: 'A valid "to" email address is required' });
  }
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return res.status(400).json({ error: 'Subject is required' });
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: 'Body is required' });
  }

  const cleanSubject = sanitize(subject);
  const html = textToHtml(body);
  const replyTo = process.env.CONTACT_NOTIFICATION_EMAIL || process.env.FROM_EMAIL || undefined;

  const result = await sendEmail({ to: to.trim(), subject: cleanSubject, html, replyTo });
  if (!result.success) {
    return res.status(502).json({ error: result.error || 'Failed to send email' });
  }

  const record = store.markSent(run, slug, { to: to.trim(), subject: cleanSubject });
  res.json({ success: true, sent: record });
});

module.exports = router;
