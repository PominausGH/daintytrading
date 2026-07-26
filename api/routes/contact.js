const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendEmail } = require('../lib/email');
const { saveSubmission } = require('../lib/store');

const router = express.Router();

const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many enquiries submitted. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const spamCheck = (body) => {
  if (body.dt_website && String(body.dt_website).trim().length > 0) return 'honeypot_filled';
  const loadedAt = parseInt(body.dt_form_loaded_at, 10);
  if (loadedAt && (Date.now() - loadedAt) < 2000) return 'submitted_too_fast';
  const message = String(body.message || '').trim();
  const urlMatches = message.match(/https?:\/\/|www\.|\.(com|net|org|ru|cn|biz|info|xyz|top|click)\b/gi) || [];
  if (urlMatches.length > 1) return 'too_many_urls';
  const letters = message.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) return 'all_caps';
  const spamWords = /\b(viagra|cialis|casino|crypto.{0,10}invest|bitcoin.{0,10}invest|loan.{0,10}approved|seo.{0,10}service|backlinks?|guest.{0,10}post)\b/i;
  if (spamWords.test(message)) return 'spam_keywords';
  if (/(.)\1{9,}/.test(message)) return 'repeated_chars';
  return null;
};

const sanitize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/<[^>]*>/g, '');
};

const escapeHtml = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

router.post('/', contactRateLimiter, async (req, res) => {
  const spamReason = spamCheck(req.body);
  if (spamReason === 'honeypot_filled') {
    return res.status(200).json({ success: true });
  }

  const { name, email, company, engagement, url, message } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required (minimum 2 characters)');
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.push('A valid email address is required');
  }
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    errors.push('Project description is required (minimum 10 characters)');
  }
  if (engagement === 'SEO/GEO audit and fix') {
    if (!url || typeof url !== 'string' || !/^https?:\/\/.+\..+/i.test(url.trim())) {
      errors.push('A website URL is required for SEO/GEO enquiries');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0] });
  }

  const data = {
    name: sanitize(name),
    email: sanitize(email).toLowerCase(),
    company: sanitize(company),
    engagement: sanitize(engagement),
    url: sanitize(url),
    message: sanitize(message),
  };

  const notifyEmail = process.env.CONTACT_NOTIFICATION_EMAIL || 'hello@daintytrading.com';
  const flagPrefix = spamReason ? `[REVIEW · ${spamReason}] ` : '';

  try {
    saveSubmission({ ...data, spamReason, ip: req.ip });
  } catch (err) {
    console.error('contact route error: failed to save submission to local store:', err.message);
  }

  try {
    const notifyResult = await sendEmail({
      to: notifyEmail,
      replyTo: data.email,
      subject: `${flagPrefix}New enquiry from ${data.name}`,
      html: `
        <h2 style="margin:0 0 16px;">New Contact Enquiry — Dainty Trading</h2>
        <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(data.company) || '—'}</p>
        <p><strong>Engagement type:</strong> ${escapeHtml(data.engagement) || '—'}</p>
        ${data.url ? `<p><strong>Website URL:</strong> <a href="${escapeHtml(data.url)}">${escapeHtml(data.url)}</a></p>` : ''}
        <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0;"/>
        <p><strong>Project description:</strong></p>
        <p style="white-space:pre-wrap;background:#f8fafc;padding:12px 16px;border-radius:6px;">${escapeHtml(data.message)}</p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0;"/>
        <p style="font-size:12px;color:#94a3b8;">Submitted: ${new Date().toISOString()} · IP: ${req.ip}</p>
      `,
    });

    if (!notifyResult.success) {
      console.error('contact route error: notification email failed:', notifyResult.error);
      return res.status(500).json({ error: 'Failed to send enquiry. Please try again or email us directly.' });
    }

    if (!spamReason) {
      const ackResult = await sendEmail({
        to: data.email,
        subject: "We've received your enquiry — Dainty Trading",
        html: `
          <h2 style="margin:0 0 16px;">Thanks for reaching out, ${escapeHtml(data.name)}!</h2>
          <p>We've received your enquiry and will reply within <strong>one business day</strong> with our read on the project.</p>
          <blockquote style="border-left:4px solid #7c5cff;padding:12px 16px;margin:16px 0;color:#374151;background:#f9f7ff;border-radius:0 6px 6px 0;">
            ${escapeHtml(data.message.substring(0, 300))}${data.message.length > 300 ? '…' : ''}
          </blockquote>
          <p>In the meantime, feel free to browse <a href="https://daintytrading.com/services.html" style="color:#7c5cff;">our services</a> or <a href="https://daintytrading.com/#projects" style="color:#7c5cff;">recent projects</a>.</p>
          <p style="margin-top:32px;">— The Dainty Trading team</p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;"/>
          <p style="font-size:12px;color:#94a3b8;">This is an automated acknowledgement. Please don't reply to this message — your original enquiry has a reply-to address set.</p>
        `,
      });
      if (!ackResult.success) {
        console.error('contact route error: acknowledgement email failed:', ackResult.error);
      }
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('contact route error:', err.message);
    res.status(500).json({ error: 'Failed to send enquiry. Please try again or email us directly.' });
  }
});

module.exports = router;
