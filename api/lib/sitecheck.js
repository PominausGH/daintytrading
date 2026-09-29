'use strict';
/**
 * Public site checker - API side.
 *
 * Flow: start (domain + email -> emailed 6-digit code) -> verify (code -> job starts) -> status
 * (long-poll until the report is ready). The heavy lifting happens in the separate `site-checker`
 * container; this module never fetches a visitor-supplied URL itself.
 *
 * State lives in memory (single API instance): sessions (unverified, 10 min) and jobs (1 hour).
 * Durable things go to DATA_DIR: a per-domain report cache (24h) and a leads log (JSONL).
 */
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { domainToASCII } = require('url');
const { escapeHtml } = require('./security');
const { buildRecommendation, GROUP_LABELS, OUTCOME_LABELS } = require('./sitecheck-copy');

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;
const RESEND_GAP_MS = 60 * 1000;
const EMAIL_DAILY_LIMIT = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const JOB_TTL_MS = 60 * 60 * 1000;
const STATUS_WAIT_MS = 8000;
const MAX_REPORT_BYTES = 256 * 1024;
const MAX_FINDINGS = 100;
const SESSION_MAX = 500;
const JOB_MAX = 300;
const CAL_URL = 'https://cal.daintytrading.com/andrewdainty/telaloom';

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'trashmail.com', 'yopmail.com', 'sharklasers.com', 'getnada.com', 'throwawaymail.com', 'maildrop.cc',
  'dispostable.com', 'fakeinbox.com', 'mintemail.com', 'tempail.com', 'mohmal.com', 'emailondeck.com',
]);
const BLOCKED_TLDS = new Set(['local', 'localhost', 'internal', 'lan', 'home', 'corp', 'intranet', 'test',
  'invalid', 'example', 'onion', 'arpa', 'localdomain']);

class ServiceError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

// ---- input validation ----------------------------------------------------------------------

function normalizeDomain(raw) {
  const bad = (msg) => new ServiceError('bad_domain', 400, msg, { field: 'domain' });
  if (typeof raw !== 'string') throw bad('Enter your website address, like example.com');
  let s = raw.trim().toLowerCase();
  if (!s || s.length > 300) throw bad('Enter your website address, like example.com');
  if (/\s/.test(s)) throw bad("That doesn't look like a website address");
  const m = s.match(/^([a-z][a-z0-9+.-]*):\/\//);
  if (m) {
    if (!['http', 'https'].includes(m[1])) throw bad('Enter a normal website address, like example.com');
    s = s.slice(m[0].length);
  }
  s = s.split(/[/?#]/)[0];
  if (s.includes('@')) throw bad('Enter just the website address, without a username');
  if (s.startsWith('[')) throw bad('Enter a domain name, not an IP address');
  if (s.includes(':')) {
    const i = s.indexOf(':');
    const port = s.slice(i + 1);
    if (!['80', '443', ''].includes(port)) throw bad('Only standard websites (ports 80 and 443) can be checked');
    s = s.slice(0, i);
  }
  s = s.replace(/\.+$/, '');
  if (!s) throw bad('Enter your website address, like example.com');
  if (net.isIP(s)) throw bad('Enter a domain name, not an IP address');
  const ascii = domainToASCII(s);
  if (!ascii || ascii.length > 253) throw bad("That doesn't look like a valid website address");
  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every((l) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(l))) {
    throw bad("That doesn't look like a valid website address");
  }
  const tld = labels[labels.length - 1];
  if (BLOCKED_TLDS.has(tld)) throw bad("That address can't be checked from the public internet");
  if (!(tld.startsWith('xn--') || /^[a-z]{2,24}$/.test(tld))) throw bad("That doesn't look like a valid website address");
  return ascii;
}

function normalizeEmail(raw) {
  const bad = (msg) => new ServiceError('bad_email', 400, msg, { field: 'email' });
  if (typeof raw !== 'string') throw bad('Enter your email address');
  const e = raw.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@<>"',;:()[\]\\]{1,64}@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]{2,}$/.test(e)) {
    throw bad("That doesn't look like a valid email address");
  }
  if (DISPOSABLE.has(e.split('@')[1])) throw bad('Please use a real email address, not a disposable one');
  return e;
}

// Key used for rate limiting only (never for sending): collapses the common ways one mailbox gets
// many addresses - plus-tags everywhere, dots and googlemail.com on Gmail - so "v.ictim+1@gmail.com"
// and "victim@gmail.com" share one limit instead of being separate victims.
function canonicalEmailKey(email) {
  const [rawLocal, rawDomain] = email.normalize('NFKC').toLowerCase().split('@');
  let local = rawLocal;
  let domain = rawDomain;
  if (domain === 'googlemail.com') domain = 'gmail.com';
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  return `${local[0]}${'*'.repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

function ownerSignal(email, domain) {
  const bare = (d) => d.replace(/^www\./, '');
  const a = bare(email.split('@')[1]);
  const b = bare(domain);
  return a === b || a.endsWith('.' + b) || b.endsWith('.' + a) ? 'same-domain' : 'other';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- report email --------------------------------------------------------------------------

const SEV = {
  high: { label: 'Important', color: '#b91c1c', bg: '#fef2f2' },
  medium: { label: 'Worth fixing', color: '#b45309', bg: '#fffbeb' },
  low: { label: 'Minor', color: '#475569', bg: '#f1f5f9' },
};

function renderReportEmail({ domain, report, recommendation, optin }) {
  const e = escapeHtml;
  const groups = Object.keys(GROUP_LABELS)
    .map((g) => {
      const items = (report.findings || []).filter((f) => f.group === g);
      if (!items.length) return '';
      return `<h3 style="margin:24px 0 8px;font-size:16px;">${e(GROUP_LABELS[g])}</h3>` + items.map((f) => {
        const s = SEV[f.severity] || SEV.low;
        return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:0 0 10px;">
          <span style="display:inline-block;font-size:11px;font-weight:700;color:${s.color};background:${s.bg};border-radius:999px;padding:2px 8px;">${e(s.label)}</span>
          <strong style="display:block;margin:6px 0 4px;">${e(f.title)}</strong>
          <span style="display:block;color:#334155;font-size:14px;">${e(f.detail)}</span>
          ${f.evidence ? `<span style="display:block;color:#64748b;font-size:12px;margin-top:6px;">What we saw: ${e(f.evidence)}</span>` : ''}
        </div>`;
      }).join('');
    }).join('');
  const good = (report.good || []).length
    ? `<h3 style="margin:24px 0 8px;font-size:16px;">What's already working</h3><ul style="margin:0;padding-left:20px;color:#334155;">${report.good.map((g) => `<li>${e(g)}</li>`).join('')}</ul>` : '';
  const notes = [...(report.notes || []), ...(report.notTested || []).map((n) => `${n.check}: ${n.reason}`)];
  const notTested = notes.length
    ? `<h3 style="margin:24px 0 8px;font-size:16px;">What we couldn't see</h3><ul style="margin:0;padding-left:20px;color:#64748b;font-size:14px;">${notes.map((n) => `<li>${e(n)}</li>`).join('')}</ul>` : '';
  const c = report.counts || {};
  const summary = report.findings && report.findings.length
    ? `${c.high || 0} important, ${c.medium || 0} worth fixing, ${c.low || 0} minor`
    : 'No issues found';
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
    <h2 style="margin:0 0 4px;">Your site check: ${e(domain)}</h2>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">${e(summary)}${report.platform ? ` · Looks like ${e(report.platform)}` : ''}</p>
    <div style="background:#f5f3ff;border-left:4px solid #7c5cff;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 8px;">
      <strong style="display:block;font-size:17px;margin-bottom:6px;">${e(recommendation.headline)}</strong>
      <span style="color:#334155;">${e(recommendation.body)}</span>
      <p style="margin:12px 0 0;"><a href="${CAL_URL}" style="color:#7c5cff;font-weight:600;">Book a free 20-minute call &rarr;</a> &nbsp;&middot;&nbsp; <a href="https://telaloom.com/contact.html" style="color:#7c5cff;">Send us a message</a> (or just reply to this email)</p>
    </div>
    ${groups}${good}${notTested}
    <hr style="margin:28px 0 12px;border:none;border-top:1px solid #e2e8f0;"/>
    <p style="font-size:12px;color:#94a3b8;">You asked for this one-off check on telaloom.com. It only looks at what any visitor or search engine can see, and it's a guide, not a full audit. ${optin ? "You ticked the box for the occasional tip, so you may hear from us again." : "We won't add you to a mailing list; you'll only hear from us if you reply."}</p>
  </div>`;
}

function renderAlertEmail({ job, report, recommendation }) {
  const e = escapeHtml;
  const top = (report.findings || []).slice(0, 8)
    .map((f) => `<li><strong>${e(f.severity)}</strong> ${e(f.title)}${f.evidence ? ` <span style="color:#64748b;">(${e(f.evidence)})</span>` : ''}</li>`).join('');
  return `<h2 style="margin:0 0 12px;">New site check: ${e(job.domain)}</h2>
    <p><strong>Requester:</strong> ${e(job.email)} (${job.ownerSignal === 'same-domain' ? 'email matches the domain: likely the owner' : 'email is on a different domain: unconfirmed owner'})</p>
    <p><strong>Outcome:</strong> ${e(OUTCOME_LABELS[report.outcome] || report.outcome)} &middot; status ${e(report.status)}${job.cached ? ' (cached report from the last 24h)' : ''}</p>
    <p><strong>Platform:</strong> ${e(report.platform || 'unknown')} &middot; <strong>Opted in to tips:</strong> ${job.optin ? 'yes' : 'no'}</p>
    <p><strong>Recommendation sent:</strong> ${e(recommendation.headline)}</p>
    ${report.outcome === 'rebuild_signal' ? `<p style="background:#fef2f2;padding:8px 12px;border-radius:6px;"><strong>Rebuild signal:</strong> ${e((report.rebuildSignals || []).join(', '))}. Review by hand before following up; the report only says "we'd recommend a rebuild".</p>` : ''}
    <p><strong>Top findings:</strong></p><ul>${top || '<li>None</li>'}</ul>
    <p style="font-size:12px;color:#94a3b8;">Requested ${new Date(job.createdAt).toISOString()} &middot; IP ${e(job.ip || '')}</p>`;
}

// ---- service ---------------------------------------------------------------------------------

function createService(opts = {}) {
  const {
    sendEmail,
    checkerUrl = process.env.SITECHECK_URL || 'http://site-checker:8000',
    fetchImpl = globalThis.fetch,
    dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
    now = () => Date.now(),
    randomCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0'),
    notifyEmail = process.env.CONTACT_NOTIFICATION_EMAIL || 'hello@daintytrading.com',
    dailyCap = Number(process.env.SITECHECK_DAILY_CAP || 100),
    hourlyCodeCap = Number(process.env.SITECHECK_HOURLY_CODE_CAP || 60),
    ipDailyChecks = Number(process.env.SITECHECK_IP_DAILY_CHECKS || 5),
    sessionMax = SESSION_MAX,
    jobMax = JOB_MAX,
    retryDelayMs = 4000,
    checkTimeoutMs = 110000,
    log = console,
  } = opts;

  const sessions = new Map();
  const jobs = new Map();
  const emailStarts = new Map();     // canonical email key -> session start times (24h)
  const ipChecks = new Map();        // client ip -> verified check times (24h)
  const inflight = new Map();        // domain -> Promise<report> of a check already running
  let codeSends = [];                // times of every code email sent (1h), start + resend
  let daily = { day: '', count: 0 };
  const leadsFile = path.join(dataDir, 'sitecheck-leads.jsonl');
  const cacheDir = path.join(dataDir, 'sitecheck-cache');

  const today = () => new Date(now()).toISOString().slice(0, 10);
  const hash = (salt, code) => crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

  function dailyCount() {
    const day = today();
    if (daily.day !== day) {
      let count = 0;
      try {
        for (const line of fs.readFileSync(leadsFile, 'utf8').split('\n')) {
          if (line && line.includes(`"day":"${day}"`)) count += 1;
        }
      } catch (_e) { /* no file yet */ }
      daily = { day, count };
    }
    return daily.count;
  }

  function prune() {
    const ts = now();
    for (const [id, s] of sessions) if (s.expiresAt + 5 * 60000 < ts) sessions.delete(id);
    for (const [id, j] of jobs) if (j.createdAt + JOB_TTL_MS < ts) jobs.delete(id);
    for (const map of [emailStarts, ipChecks]) {
      for (const [k, arr] of map) {
        const keep = arr.filter((t) => ts - t < 24 * 3600 * 1000);
        if (keep.length) map.set(k, keep); else map.delete(k);
      }
    }
    codeSends = codeSends.filter((t) => ts - t < 3600 * 1000);
    // Deliberately no eviction of live sessions/jobs: if we're full, new requests are turned away
    // (see start/verify) instead of letting a flood push legitimate users out.
  }

  function checkCodeBudget() {
    if (codeSends.length >= hourlyCodeCap) {
      throw new ServiceError('busy', 503, "We're sending a lot of codes right now. Please try again in a little while, or use the contact form and we'll do it by hand.");
    }
  }

  async function sendCode(session, code) {
    const e = escapeHtml;
    const res = await sendEmail({
      to: session.email,
      subject: `Your TelaLoom site check code: ${code}`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a;">
        <h2 style="margin:0 0 8px;">Your verification code</h2>
        <p style="margin:0 0 16px;color:#334155;">Enter this code to run the free site check for <strong>${e(session.domain)}</strong>:</p>
        <p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:0 0 16px;">${e(code)}</p>
        <p style="color:#64748b;font-size:13px;">It expires in 10 minutes. If you didn't ask for this, ignore this email; nothing will happen.</p>
      </div>`,
    });
    return !!(res && res.success);
  }

  async function start({ domain, email, optin, ip, honeypot, loadedAt }) {
    if (honeypot && String(honeypot).trim()) {
      return { sessionId: crypto.randomBytes(16).toString('hex'), emailMasked: 'a***@example.com', expiresInSeconds: CODE_TTL_MS / 1000 };
    }
    const ts = now();
    const age = loadedAt ? ts - parseInt(loadedAt, 10) : null;
    if (age !== null && age >= 0 && age < 1500) {
      throw new ServiceError('too_fast', 429, 'That was a bit quick. Please try again.');
    }
    const d = normalizeDomain(domain);
    const e = normalizeEmail(email);
    prune();
    if (dailyCount() >= dailyCap) {
      throw new ServiceError('busy', 503, "We're running a lot of checks today. Please try again tomorrow, or use the contact form and we'll do it by hand.");
    }
    if (sessions.size >= sessionMax) {
      throw new ServiceError('busy', 503, "We're busy right now. Please try again in a few minutes.");
    }
    checkCodeBudget();
    const emailKey = canonicalEmailKey(e);
    const recent = (emailStarts.get(emailKey) || []).filter((t) => ts - t < 24 * 3600 * 1000);
    if (recent.length >= EMAIL_DAILY_LIMIT) {
      throw new ServiceError('email_limit', 429, 'That email address has already been used for several checks today. Please try again tomorrow.');
    }
    codeSends.push(ts);
    const id = crypto.randomBytes(16).toString('hex');
    const code = randomCode();
    const salt = crypto.randomBytes(8).toString('hex');
    const session = {
      id, domain: d, email: e, optin: !!optin, ip: ip || '', salt, codeHash: hash(salt, code),
      attempts: 0, resends: 0, sentAt: ts, expiresAt: ts + CODE_TTL_MS, createdAt: ts,
    };
    sessions.set(id, session);
    emailStarts.set(emailKey, [...recent, ts]);
    let sent = false;
    try { sent = await sendCode(session, code); } catch (err) { log.error('[sitecheck] code email threw:', err.message); }
    if (!sent) {
      sessions.delete(id);
      emailStarts.set(emailKey, recent);
      throw new ServiceError('email_failed', 502, "We couldn't send the code just now. Please try again in a minute.");
    }
    return { sessionId: id, emailMasked: maskEmail(e), expiresInSeconds: CODE_TTL_MS / 1000 };
  }

  function liveSession(id) {
    const s = typeof id === 'string' ? sessions.get(id) : null;
    if (!s || s.expiresAt < now()) {
      if (s) sessions.delete(id);
      throw new ServiceError('expired', 410, 'That code has expired. Please start again.');
    }
    return s;
  }

  async function resend({ sessionId }) {
    const s = liveSession(sessionId);
    const ts = now();
    if (s.resends >= MAX_RESENDS) {
      throw new ServiceError('resend_limit', 429, "We've already sent you a few codes. Check your spam folder, or start again.");
    }
    if (ts - s.sentAt < RESEND_GAP_MS) {
      const wait = Math.ceil((RESEND_GAP_MS - (ts - s.sentAt)) / 1000);
      throw new ServiceError('resend_too_soon', 429, `Please wait ${wait} seconds before asking for another code.`, { retryAfterSeconds: wait });
    }
    prune();
    checkCodeBudget();
    codeSends.push(ts);
    const code = randomCode();
    s.salt = crypto.randomBytes(8).toString('hex');
    s.codeHash = hash(s.salt, code);
    s.resends += 1;
    s.sentAt = ts;
    s.expiresAt = ts + CODE_TTL_MS;
    let sent = false;
    try { sent = await sendCode(s, code); } catch (err) { log.error('[sitecheck] code email threw:', err.message); }
    if (!sent) throw new ServiceError('email_failed', 502, "We couldn't send the code just now. Please try again in a minute.");
    return { ok: true, expiresInSeconds: CODE_TTL_MS / 1000, resendsLeft: MAX_RESENDS - s.resends };
  }

  async function verify({ sessionId, code }) {
    const s = liveSession(sessionId);
    const given = String(code == null ? '' : code).trim();
    if (!/^\d{6}$/.test(given)) {
      throw new ServiceError('bad_code_format', 400, 'Enter the 6-digit code from your email.', { field: 'code' });
    }
    s.attempts += 1;
    const a = Buffer.from(hash(s.salt, given));
    const b = Buffer.from(s.codeHash);
    if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) {
      if (s.attempts >= MAX_ATTEMPTS) {
        sessions.delete(s.id);
        throw new ServiceError('locked', 429, 'Too many wrong codes. Please start again.');
      }
      throw new ServiceError('wrong_code', 400, "That code isn't right.", { attemptsLeft: MAX_ATTEMPTS - s.attempts });
    }
    sessions.delete(s.id);
    prune();
    if (dailyCount() >= dailyCap) {
      throw new ServiceError('busy', 503, "We're running a lot of checks today. Please try again tomorrow.");
    }
    if (jobs.size >= jobMax) {
      throw new ServiceError('busy', 503, "We're busy right now. Please try again in a few minutes.");
    }
    // One visitor can't use up the whole day's allowance (each check costs us real work).
    const ipKey = s.ip || 'unknown';
    const ipRecent = (ipChecks.get(ipKey) || []).filter((t) => now() - t < 24 * 3600 * 1000);
    if (ipRecent.length >= ipDailyChecks) {
      throw new ServiceError('ip_limit', 429, "You've run several checks today already. Please try again tomorrow, or use the contact form and we'll look at it by hand.");
    }
    ipChecks.set(ipKey, [...ipRecent, now()]);
    daily.count += 1;
    const job = {
      id: crypto.randomBytes(16).toString('hex'), domain: s.domain, email: s.email, optin: s.optin,
      ip: s.ip, ownerSignal: ownerSignal(s.email, s.domain), status: 'running', createdAt: now(),
      report: null, recommendation: null, error: null, cached: false, waiters: [],
    };
    jobs.set(job.id, job);
    const cached = readCache(job.domain);
    if (cached) {
      setImmediate(() => finish(job, cached, true));
    } else {
      run(job).catch((err) => fail(job, err));
    }
    return { jobId: job.id };
  }

  function readCache(domain) {
    try {
      const file = path.join(cacheDir, crypto.createHash('sha256').update(domain).digest('hex').slice(0, 32) + '.json');
      const entry = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (entry && entry.domain === domain && now() - entry.at < CACHE_TTL_MS && entry.report && Array.isArray(entry.report.findings)) {
        return entry.report;
      }
    } catch (_e) { /* no cache */ }
    return null;
  }

  function writeCache(domain, report) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
      const file = path.join(cacheDir, crypto.createHash('sha256').update(domain).digest('hex').slice(0, 32) + '.json');
      fs.writeFileSync(file, JSON.stringify({ domain, at: now(), report }), { mode: 0o600 });
    } catch (err) { log.error('[sitecheck] cache write failed:', err.message); }
  }

  async function callChecker(domain) {
    let netFails = 0;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let res;
      try {
        res = await fetchImpl(`${checkerUrl}/check`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ domain }),
          signal: AbortSignal.timeout(checkTimeoutMs),
        });
      } catch (err) {
        netFails += 1;
        log.error('[sitecheck] checker unreachable:', err.message);
        if (netFails >= 2) throw new ServiceError('checker_down', 502, 'The checker is temporarily unavailable. Please try again in a few minutes.');
        await sleep(retryDelayMs);
        continue;
      }
      if (res.status === 429) { await sleep(retryDelayMs); continue; }
      let body = null;
      try { body = await res.json(); } catch (_e) { body = null; }
      if (res.status === 400 && body && body.code === 'bad_domain') throw new ServiceError('bad_domain', 400, body.error);
      if (!res.ok || !body || !Array.isArray(body.findings) || typeof body.outcome !== 'string'
          || body.findings.length > MAX_FINDINGS || JSON.stringify(body).length > MAX_REPORT_BYTES) {
        // Also guards the 128MB api container: an oversized report would be held in memory, cached,
        // emailed twice and sent to the browser.
        log.error('[sitecheck] checker returned an unusable report, status', res.status);
        throw new ServiceError('checker_error', 502, 'Something went wrong running the check. Please try again in a few minutes.');
      }
      return body;
    }
    throw new ServiceError('busy', 503, 'The checker is busy right now. Please try again in a few minutes.');
  }

  async function run(job) {
    // If the same domain is already being checked (many people asking about one site at once), share that
    // check instead of running it again and holding another of the checker's three slots.
    let pending = inflight.get(job.domain);
    if (!pending) {
      pending = callChecker(job.domain).finally(() => inflight.delete(job.domain));
      inflight.set(job.domain, pending);
    }
    const report = await pending;
    if (report.status !== 'unreachable' && report.status !== 'opted_out') writeCache(job.domain, report);
    finish(job, report, false);
  }

  function settle(job) {
    const waiters = job.waiters.splice(0);
    waiters.forEach((w) => w());
  }

  function fail(job, err) {
    job.status = 'error';
    job.error = err instanceof ServiceError ? err.message : 'Something went wrong running the check. Please try again in a few minutes.';
    if (!(err instanceof ServiceError)) log.error('[sitecheck] job failed:', err && err.stack || err);
    settle(job);
  }

  function finish(job, report, cached) {
    job.report = report;
    job.recommendation = buildRecommendation(report);
    job.cached = cached;
    job.status = 'done';
    settle(job);
    postProcess(job).catch((err) => log.error('[sitecheck] post-processing failed:', err.message));
  }

  async function postProcess(job) {
    const { report, recommendation } = job;
    try {
      const r = await sendEmail({
        to: job.email,
        subject: `Your site check for ${job.domain}`,
        html: renderReportEmail({ domain: job.domain, report, recommendation, optin: job.optin }),
        replyTo: 'hello@telaloom.com',
      });
      if (!r || !r.success) log.error('[sitecheck] report email failed:', r && r.error);
    } catch (err) { log.error('[sitecheck] report email threw:', err.message); }
    try {
      const flag = report.outcome === 'rebuild_signal' ? ' · REBUILD SIGNAL' : '';
      await sendEmail({
        to: notifyEmail,
        replyTo: job.email,
        subject: `[Site check${flag}] ${job.domain} · ${OUTCOME_LABELS[report.outcome] || report.outcome} · ${job.ownerSignal === 'same-domain' ? 'likely owner' : 'unconfirmed'}`,
        html: renderAlertEmail({ job, report, recommendation }),
      });
    } catch (err) { log.error('[sitecheck] lead alert threw:', err.message); }
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      const line = {
        day: today(), at: new Date(now()).toISOString(), email: job.email, domain: job.domain,
        ownerSignal: job.ownerSignal, optin: job.optin, status: report.status, outcome: report.outcome,
        counts: report.counts, platform: report.platform || '', cached: job.cached, ip: job.ip,
      };
      fs.appendFileSync(leadsFile, JSON.stringify(line) + '\n', { mode: 0o600 });
    } catch (err) { log.error('[sitecheck] lead log failed:', err.message); }
  }

  function publicJob(job) {
    const out = { status: job.status, domain: job.domain };
    if (job.status === 'done') {
      out.report = job.report;
      out.recommendation = job.recommendation;
      out.cached = job.cached;
    }
    if (job.status === 'error') out.error = job.error;
    return out;
  }

  async function status(jobId, { wait = false } = {}) {
    const job = typeof jobId === 'string' ? jobs.get(jobId) : null;
    if (!job) throw new ServiceError('not_found', 404, 'That check has expired. Please start again.');
    if (wait && job.status === 'running') {
      await new Promise((resolve) => {
        // Must stay under nginx's 10s proxy_read_timeout on /api/; the browser just asks again.
        const timer = setTimeout(resolve, STATUS_WAIT_MS);
        job.waiters.push(() => { clearTimeout(timer); resolve(); });
      });
    }
    return publicJob(job);
  }

  async function health() {
    try {
      const res = await fetchImpl(`${checkerUrl}/health`, { signal: AbortSignal.timeout(3000) });
      return { ok: res.ok };
    } catch (_e) {
      return { ok: false };
    }
  }

  return { start, resend, verify, status, health, _state: { sessions, jobs, emailStarts } };
}

module.exports = {
  createService, ServiceError, normalizeDomain, normalizeEmail, canonicalEmailKey, ownerSignal, maskEmail, renderReportEmail,
  renderAlertEmail, CODE_TTL_MS, MAX_ATTEMPTS, MAX_RESENDS, RESEND_GAP_MS,
};
