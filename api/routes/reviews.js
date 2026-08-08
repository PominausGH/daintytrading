const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendEmail } = require('../lib/email');
const { saveReview } = require('../lib/store');
const { spamCheck, sanitize, escapeHtml } = require('../lib/security');

const router = express.Router();

const reviewRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many reviews submitted. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', reviewRateLimiter, async (req, res) => {
  const spamReason = spamCheck(req.body, 'quote');
  if (spamReason === 'honeypot_filled') {
    return res.status(200).json({ success: true });
  }

  const { name, email, company, project, rating, quote } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required (minimum 2 characters)');
  }
  if (!quote || typeof quote !== 'string' || quote.trim().length < 15) {
    errors.push('A review of at least 15 characters is required');
  }
  const ratingNum = parseInt(rating, 10);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    errors.push('A star rating between 1 and 5 is required');
  }
  if (email && typeof email === 'string' && email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push('That email address doesn’t look right');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0] });
  }

  const data = {
    name: sanitize(name),
    email: sanitize(email).toLowerCase(),
    company: sanitize(company),
    project: sanitize(project),
    rating: ratingNum,
    quote: sanitize(quote),
  };

  const notifyEmail = process.env.CONTACT_NOTIFICATION_EMAIL || 'hello@daintytrading.com';
  const flagPrefix = spamReason ? `[REVIEW · ${spamReason}] ` : '';

  try {
    saveReview({ ...data, spamReason, ip: req.ip });
  } catch (err) {
    console.error('reviews route error: failed to save submission to local store:', err.message);
  }

  try {
    const notifyResult = await sendEmail({
      to: notifyEmail,
      replyTo: data.email || undefined,
      subject: `${flagPrefix}New review from ${data.name} (${data.rating}★) — awaiting approval`,
      html: `
        <h2 style="margin:0 0 16px;">New Review Submitted — Dainty Trading</h2>
        <p>This is <strong>not published automatically</strong> — it's saved to review-submissions.jsonl for you to approve and add to the site.</p>
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Company:</strong> ${escapeHtml(data.company) || '—'}</p>
        <p><strong>Project:</strong> ${escapeHtml(data.project) || '—'}</p>
        <p><strong>Rating:</strong> ${'★'.repeat(data.rating)}${'☆'.repeat(5 - data.rating)} (${data.rating}/5)</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email) || '—'}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0;"/>
        <p><strong>Review:</strong></p>
        <p style="white-space:pre-wrap;background:#f8fafc;padding:12px 16px;border-radius:6px;">${escapeHtml(data.quote)}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0;"/>
        <p style="font-size:12px;color:#94a3b8;">Submitted: ${new Date().toISOString()} · IP: ${req.ip}</p>
      `,
    });

    if (!notifyResult.success) {
      console.error('reviews route error: notification email failed:', notifyResult.error);
      return res.status(500).json({ error: 'Failed to submit review. Please try again or email us directly.' });
    }

    if (!spamReason && data.email) {
      const ackResult = await sendEmail({
        to: data.email,
        subject: 'Thanks for the review — Dainty Trading',
        html: `
          <h2 style="margin:0 0 16px;">Thanks, ${escapeHtml(data.name)}!</h2>
          <p>We read every review that comes in. Most end up on the site within a few days — we'll credit you by name${data.company ? ' and company' : ''} unless you tell us otherwise.</p>
          <p style="margin-top:32px;">— The Dainty Trading team</p>
        `,
      });
      if (!ackResult.success) {
        console.error('reviews route error: acknowledgement email failed:', ackResult.error);
      }
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('reviews route error:', err.message);
    res.status(500).json({ error: 'Failed to submit review. Please try again or email us directly.' });
  }
});

module.exports = router;
