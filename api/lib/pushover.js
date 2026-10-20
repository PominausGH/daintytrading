'use strict';
// Push alerts to Andrew's phone through Pushover (https://pushover.net/api).
// Priority 2 ("emergency") repeats every RETRY seconds until acknowledged in the app, and gets
// through Do Not Disturb when the app's Critical Alerts setting is on. Only support-alerts.js
// decides who is allowed to send one.

const API_URL = 'https://api.pushover.net/1/messages.json';
const RETRY_S = 60; // Pushover minimum is 30
const EXPIRE_S = 3 * 60 * 60; // stop repeating after 3h (the Scale urgent promise)

function credentials(env = process.env) {
  const token = env.PUSHOVER_APP_TOKEN || '';
  const user = env.PUSHOVER_USER_KEY || '';
  return token && user ? { token, user } : null;
}

async function sendPush({ title, message, priority = 0, url, urlTitle }, { fetchImpl = fetch, env = process.env } = {}) {
  const creds = credentials(env);
  if (!creds) {
    console.error(`[pushover] not configured, dropped p${priority}: ${title}`);
    return { ok: false, skipped: 'not_configured' };
  }
  const form = new URLSearchParams({
    token: creds.token,
    user: creds.user,
    title: String(title || 'TelaLoom alert').slice(0, 250),
    message: String(message || '-').slice(0, 1024),
    priority: String(priority),
  });
  if (priority === 2) {
    form.set('retry', String(RETRY_S));
    form.set('expire', String(EXPIRE_S));
  }
  if (url) form.set('url', url);
  if (urlTitle) form.set('url_title', urlTitle);
  try {
    const res = await fetchImpl(API_URL, { method: 'POST', body: form, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      // The body echoes request errors, never the token.
      console.error('[pushover] send failed:', res.status, (await res.text()).slice(0, 200));
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.error('[pushover] send exception:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendPush, credentials, RETRY_S, EXPIRE_S };
