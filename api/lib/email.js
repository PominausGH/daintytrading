/**
 * Unified email helper — same provider precedence as brightpath:
 *   1. Brevo (BREVO_API_KEY)
 *   2. Resend (RESEND_API_KEY)
 *
 * sendEmail({ to, subject, html, replyTo? })
 */

const FROM_NAME = process.env.FROM_NAME || 'Dainty Trading';
const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@daintytrading.com';

const BREVO_API_KEY = process.env.BREVO_API_KEY || null;

let resendClient = null;
if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  } catch (e) {
    console.warn('[email] resend package not installed:', e.message);
  }
}

if (!BREVO_API_KEY && !resendClient) {
  console.warn('[email] No provider configured — emails will be logged only. Set BREVO_API_KEY or RESEND_API_KEY in .env');
}

async function sendEmail({ to, subject, html, replyTo }) {
  if (!to || !subject || !html) {
    return { success: false, error: 'Missing to/subject/html' };
  }

  if (BREVO_API_KEY) {
    try {
      const payload = {
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      };
      if (replyTo) payload.replyTo = { email: replyTo };

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.text();
      if (!res.ok) {
        console.error('[email] Brevo error:', res.status, body.slice(0, 200));
        if (!resendClient) return { success: false, error: `Brevo HTTP ${res.status}` };
        // fall through to Resend
      } else {
        return { success: true, provider: 'brevo' };
      }
    } catch (err) {
      console.error('[email] Brevo exception:', err.message);
      if (!resendClient) return { success: false, error: err.message };
    }
  }

  if (resendClient) {
    try {
      await resendClient.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      });
      return { success: true, provider: 'resend' };
    } catch (err) {
      console.error('[email] Resend error:', err.message);
      return { success: false, error: err.message };
    }
  }

  console.warn(`[email] DROPPED (no provider): to=${to} subject="${subject}"`);
  return { success: true, provider: 'noop' };
}

module.exports = { sendEmail };
