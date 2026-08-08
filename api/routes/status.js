const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendEmail } = require('../lib/email');
const { getClient, saveClientNote, listClientNotes } = require('../lib/clients-store');
const { spamCheck, sanitize, escapeHtml } = require('../lib/security');

const router = express.Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const noteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many updates submitted. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/:token', readLimiter, (req, res) => {
  const client = getClient(req.params.token);
  if (!client) return res.status(404).json({ error: 'Not found' });
  const notes = listClientNotes(req.params.token).map((n) => ({
    name: n.name,
    note: n.note,
    targetDate: n.targetDate,
    submittedAt: n.submittedAt,
    author: n.author || 'client',
  }));
  res.json({
    clientName: client.clientName,
    project: client.project,
    status: client.status,
    phase: client.phase,
    nextMilestone: client.nextMilestone,
    updatedAt: client.updatedAt,
    notes,
  });
});

router.post('/:token/notes', noteLimiter, async (req, res) => {
  const client = getClient(req.params.token);
  if (!client) return res.status(404).json({ error: 'Not found' });

  const spamReason = spamCheck(req.body, 'note');
  if (spamReason === 'honeypot_filled') {
    return res.status(200).json({ success: true });
  }

  const { name, note, targetDate } = req.body;
  const errors = [];
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required (minimum 2 characters)');
  }
  if (!note || typeof note !== 'string' || note.trim().length < 5) {
    errors.push('A note of at least 5 characters is required');
  }
  if (targetDate && typeof targetDate === 'string' && targetDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate.trim())) {
    errors.push('Target date must be a valid date');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0] });
  }

  const data = {
    name: sanitize(name),
    note: sanitize(note),
    targetDate: targetDate ? sanitize(targetDate) : null,
  };

  try {
    saveClientNote(req.params.token, data);
  } catch (err) {
    console.error('status route error: failed to save note:', err.message);
    return res.status(500).json({ error: 'Failed to save your note. Please try again or email us directly.' });
  }

  const notifyEmail = process.env.CONTACT_NOTIFICATION_EMAIL || 'hello@daintytrading.com';
  const flagPrefix = spamReason ? `[REVIEW · ${spamReason}] ` : '';
  const emailHtml = `
    <h2 style="margin:0 0 16px;">New note — ${escapeHtml(client.project)}</h2>
    <p><strong>From:</strong> ${escapeHtml(data.name)}</p>
    ${data.targetDate ? `<p><strong>Target date:</strong> ${escapeHtml(data.targetDate)}</p>` : ''}
    <p style="white-space:pre-wrap;background:#f8fafc;padding:12px 16px;border-radius:6px;">${escapeHtml(data.note)}</p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0;"/>
    <p style="font-size:12px;color:#94a3b8;">Status page: https://daintytrading.com/status.html?token=${req.params.token}</p>
  `;
  // Notify recipients in parallel — the default studio inbox, plus a
  // per-client extra recipient (e.g. Darren's andrew@eklawyers.com.au) when set.
  const recipients = [notifyEmail, ...(client.notifyEmail ? [client.notifyEmail] : [])];
  await Promise.all(recipients.map(async (to) => {
    const result = await sendEmail({
      to,
      subject: `${flagPrefix}${client.clientName} left a note on their project status page`,
      html: emailHtml,
    });
    if (!result.success) {
      console.error(`status route error: notification email to ${to} failed:`, result.error);
    }
  }));

  res.status(201).json({ success: true });
});

module.exports = router;
