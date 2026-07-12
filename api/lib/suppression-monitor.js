const { sendEmail } = require('./email');

const BREVO_API_KEY = process.env.BREVO_API_KEY || null;
const WATCHED_EMAIL = process.env.CONTACT_NOTIFICATION_EMAIL || 'hello@daintytrading.com';
const ALERT_EMAIL = process.env.SUPPRESSION_ALERT_EMAIL || 'andrew.dainty@gmail.com';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function checkAndHeal() {
  if (!BREVO_API_KEY) return;

  let blocked;
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/blockedContacts?limit=50', {
      headers: { 'api-key': BREVO_API_KEY, accept: 'application/json' },
    });
    if (!res.ok) {
      console.error('[suppression-monitor] blockedContacts lookup failed:', res.status, await res.text());
      return;
    }
    const body = await res.json();
    blocked = (body.contacts || []).find((c) => c.email.toLowerCase() === WATCHED_EMAIL.toLowerCase());
    if (!blocked) return; // not suppressed — healthy
  } catch (err) {
    console.error('[suppression-monitor] lookup exception:', err.message);
    return;
  }

  console.error(`[suppression-monitor] ${WATCHED_EMAIL} is suppressed:`, blocked.reason && blocked.reason.message);

  const unblockRes = await fetch(`https://api.brevo.com/v3/smtp/blockedContacts/${encodeURIComponent(WATCHED_EMAIL)}`, {
    method: 'DELETE',
    headers: { 'api-key': BREVO_API_KEY, accept: 'application/json' },
  }).catch((err) => {
    console.error('[suppression-monitor] unblock request failed:', err.message);
    return null;
  });
  const unblocked = !!unblockRes && unblockRes.status === 204;
  if (unblocked) console.error(`[suppression-monitor] ${WATCHED_EMAIL} auto-unblocked`);

  await sendEmail({
    to: ALERT_EMAIL,
    subject: `[Dainty Trading] ${WATCHED_EMAIL} was suppressed in Brevo${unblocked ? ' (auto-unblocked)' : ' — unblock FAILED, check manually'}`,
    html: `
      <p><strong>${WATCHED_EMAIL}</strong> was found on Brevo's suppression list.</p>
      <p><strong>Reason:</strong> ${blocked.reason && blocked.reason.message ? blocked.reason.message : 'unknown'} (code: ${blocked.reason && blocked.reason.code})</p>
      <p><strong>Blocked at:</strong> ${blocked.blockedAt || 'unknown'}</p>
      <p><strong>Auto-unblock:</strong> ${unblocked ? 'succeeded — contact form notifications should flow again.' : 'FAILED — check Brevo dashboard manually.'}</p>
      <p>If this keeps recurring, the underlying mail route to ${WATCHED_EMAIL} (Cloudflare Email Routing) is likely bouncing again — check that destination address is still verified.</p>
    `,
  }).catch((err) => console.error('[suppression-monitor] alert email failed:', err.message));
}

function startSuppressionMonitor() {
  checkAndHeal();
  setInterval(checkAndHeal, CHECK_INTERVAL_MS);
}

module.exports = { startSuppressionMonitor };
