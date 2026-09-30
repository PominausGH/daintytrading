'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createService, ServiceError, normalizeDomain, normalizeEmail, ownerSignal, maskEmail, renderReportEmail,
} = require('../lib/sitecheck');
const { buildRecommendation } = require('../lib/sitecheck-copy');

const REPORT = {
  domain: 'acme.com.au', status: 'complete', outcome: 'small_fixes', platform: 'WordPress',
  counts: { high: 0, medium: 1, low: 1 }, groupsAffected: ['measurement'], rebuildSignals: [],
  findings: [
    { id: 'no_analytics', group: 'measurement', severity: 'medium', title: 'No analytics on the site', detail: 'Without analytics...', evidence: 'None found' },
    { id: 'no_llms_txt', group: 'findability', severity: 'low', title: 'No llms.txt file', detail: 'llms.txt is...', evidence: '' },
  ],
  good: ['Served over HTTPS with a valid certificate'], notTested: [], notes: [],
  meta: { requests: 12, durationMs: 1200, checkerVersion: '1.0' },
};

function harness(overrides = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitecheck-'));
  const emails = [];
  const clock = { t: 1_800_000_000_000 };
  const checkerCalls = [];
  const svc = createService({
    sendEmail: async (m) => { emails.push(m); return { success: true }; },
    fetchImpl: async (url, init) => {
      if (url.endsWith('/health')) return { ok: true };
      checkerCalls.push(JSON.parse(init.body).domain);
      return { status: 200, ok: true, json: async () => ({ ...REPORT, domain: JSON.parse(init.body).domain }) };
    },
    dataDir,
    now: () => clock.t,
    randomCode: () => '123456',
    notifyEmail: 'alerts@example.org',
    retryDelayMs: 1,
    log: { error() {}, warn() {}, log() {} },
    ...overrides,
  });
  return { svc, emails, clock, checkerCalls, dataDir };
}

const good = { domain: 'https://www.Acme.com.au/about', email: 'Owner@Acme.com.au', loadedAt: '1' };
const settle = () => new Promise((r) => setTimeout(r, 30));

// ---- validation ----------------------------------------------------------------------------

test('normalizeDomain accepts real addresses and strips the rest', () => {
  assert.equal(normalizeDomain(' HTTPS://Example.com/x?y#z '), 'example.com');
  assert.equal(normalizeDomain('example.com:443'), 'example.com');
  assert.equal(normalizeDomain('bücher.de'), 'xn--bcher-kva.de');
  assert.equal(normalizeDomain('shop.acme.co.uk.'), 'shop.acme.co.uk');
});

test('normalizeDomain rejects anything that is not a public website name', () => {
  for (const bad of ['', '   ', null, 5, 'localhost', '127.0.0.1', '169.254.169.254', '[::1]', '::1', 'intranet',
    'printer.local', 'x.internal', 'user@example.com', 'ftp://example.com', 'example.com:8080', 'exa mple.com',
    'example..com', '-a.example.com', 'a'.repeat(64) + '.com', 'example.c', 'example.123', 'x.test']) {
    assert.throws(() => normalizeDomain(bad), (e) => e instanceof ServiceError && e.code === 'bad_domain', String(bad));
  }
});

test('normalizeEmail', () => {
  assert.equal(normalizeEmail('  A.B+tag@Example.COM '), 'a.b+tag@example.com');
  for (const bad of ['', null, 'nope', 'a@b', 'a b@c.com', 'a@b.c', '<x>@b.com', 'a@mailinator.com', 'x'.repeat(65) + '@b.com']) {
    assert.throws(() => normalizeEmail(bad), (e) => e.code === 'bad_email', String(bad));
  }
});

test('ownerSignal and maskEmail', () => {
  assert.equal(ownerSignal('me@acme.com.au', 'www.acme.com.au'), 'same-domain');
  assert.equal(ownerSignal('me@mail.acme.com.au', 'acme.com.au'), 'same-domain');
  assert.equal(ownerSignal('me@gmail.com', 'acme.com.au'), 'other');
  assert.equal(maskEmail('owner@acme.com.au'), 'o****@acme.com.au');
});

// ---- code flow -----------------------------------------------------------------------------

test('start emails a 6-digit code, masks the address and never stores the code in plain text', async () => {
  const { svc, emails } = harness();
  const r = await svc.start({ ...good, ip: '1.2.3.4' });
  assert.match(r.sessionId, /^[0-9a-f]{32}$/);
  assert.equal(r.emailMasked, 'o****@acme.com.au');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'owner@acme.com.au');
  assert.match(emails[0].subject, /123456/);
  assert.ok(emails[0].html.includes('acme.com.au'));
  const stored = JSON.stringify([...svc._state.sessions.values()]);
  assert.ok(!stored.includes('123456'));
});

test('wrong code counts down attempts and the 5th wrong locks the session', async () => {
  const { svc } = harness();
  const { sessionId } = await svc.start(good);
  for (let left = 4; left >= 1; left -= 1) {
    await assert.rejects(svc.verify({ sessionId, code: '000000' }), (e) => e.code === 'wrong_code' && e.extra.attemptsLeft === left);
  }
  await assert.rejects(svc.verify({ sessionId, code: '000000' }), (e) => e.code === 'locked');
  await assert.rejects(svc.verify({ sessionId, code: '123456' }), (e) => e.code === 'expired');
});

test('a malformed code is rejected without using an attempt', async () => {
  const { svc } = harness();
  const { sessionId } = await svc.start(good);
  await assert.rejects(svc.verify({ sessionId, code: 'abc' }), (e) => e.code === 'bad_code_format');
  assert.equal(svc._state.sessions.get(sessionId).attempts, 0);
});

test('codes expire after 10 minutes', async () => {
  const { svc, clock } = harness();
  const { sessionId } = await svc.start(good);
  clock.t += 10 * 60 * 1000 + 1;
  await assert.rejects(svc.verify({ sessionId, code: '123456' }), (e) => e.code === 'expired' && e.status === 410);
});

test('unknown session ids are rejected', async () => {
  const { svc } = harness();
  await assert.rejects(svc.verify({ sessionId: 'nope', code: '123456' }), (e) => e.code === 'expired');
  await assert.rejects(svc.verify({ sessionId: undefined, code: '123456' }), (e) => e.code === 'expired');
});

test('resend: throttled to one a minute, capped at three, and the old code stops working', async () => {
  let n = 0;
  const { svc, emails, clock } = harness({ randomCode: () => String(111111 + n++) });
  const { sessionId } = await svc.start(good); // code 111111
  await assert.rejects(svc.resend({ sessionId }), (e) => e.code === 'resend_too_soon' && e.extra.retryAfterSeconds > 0);
  clock.t += 61000;
  await svc.resend({ sessionId }); // code 111112
  assert.equal(emails.length, 2);
  await assert.rejects(svc.verify({ sessionId, code: '111111' }), (e) => e.code === 'wrong_code');
  clock.t += 61000; await svc.resend({ sessionId });
  clock.t += 61000; await svc.resend({ sessionId });
  clock.t += 61000;
  await assert.rejects(svc.resend({ sessionId }), (e) => e.code === 'resend_limit');
});

test('resend does not reset the attempt counter (no brute force via resend)', async () => {
  const { svc, clock } = harness();
  const { sessionId } = await svc.start(good);
  await assert.rejects(svc.verify({ sessionId, code: '000000' }), (e) => e.code === 'wrong_code');
  clock.t += 61000;
  await svc.resend({ sessionId });
  assert.equal(svc._state.sessions.get(sessionId).attempts, 1);
});

test('honeypot: pretends to succeed but sends nothing', async () => {
  const { svc, emails } = harness();
  const r = await svc.start({ ...good, honeypot: 'http://spam' });
  assert.ok(r.sessionId);
  assert.equal(emails.length, 0);
  await assert.rejects(svc.verify({ sessionId: r.sessionId, code: '123456' }), (e) => e.code === 'expired');
});

test('submitting faster than a human can is rejected', async () => {
  const { svc, clock } = harness();
  await assert.rejects(svc.start({ ...good, loadedAt: String(clock.t - 300) }), (e) => e.code === 'too_fast');
});

test('one email address can start 3 checks a day', async () => {
  const { svc, clock } = harness();
  for (let i = 0; i < 3; i += 1) await svc.start({ ...good, domain: `site${i}.com` });
  await assert.rejects(svc.start({ ...good, domain: 'site9.com' }), (e) => e.code === 'email_limit');
  clock.t += 25 * 3600 * 1000;
  await svc.start({ ...good, domain: 'site9.com' });
});

test('daily cap stops new checks', async () => {
  const { svc } = harness({ dailyCap: 1 });
  const a = await svc.start(good);
  await svc.verify({ sessionId: a.sessionId, code: '123456' });
  await assert.rejects(svc.start({ ...good, email: 'other@acme.com.au' }), (e) => e.code === 'busy' && e.status === 503);
});

test('a failed code email rolls the session back so it is not counted', async () => {
  const { svc } = harness({ sendEmail: async () => ({ success: false }) });
  await assert.rejects(svc.start(good), (e) => e.code === 'email_failed');
  assert.equal(svc._state.sessions.size, 0);
  assert.equal((svc._state.emailStarts.get('owner@acme.com.au') || []).length, 0);
});

// ---- checking + reporting ------------------------------------------------------------------

test('verify runs the check, long-poll returns the report, emails and lead log follow', async () => {
  const { svc, emails, checkerCalls, dataDir } = harness();
  const { sessionId } = await svc.start({ ...good, optin: true, ip: '9.9.9.9' });
  const { jobId } = await svc.verify({ sessionId, code: '123456' });
  const done = await svc.status(jobId, { wait: true });
  assert.equal(done.status, 'done');
  assert.equal(done.domain, 'www.acme.com.au');
  assert.equal(done.report.outcome, 'small_fixes');
  assert.equal(done.recommendation.headline, 'A handful of small fixes');
  assert.equal(done.cached, false);
  assert.ok(!JSON.stringify(done).includes('owner@acme.com.au'), 'requester email must never come back to the browser');
  assert.deepEqual(checkerCalls, ['www.acme.com.au']);

  await settle();
  const report = emails.find((m) => m.subject.startsWith('Your site check for'));
  const alert = emails.find((m) => m.subject.startsWith('[Site check'));
  assert.equal(report.to, 'owner@acme.com.au');
  assert.ok(report.html.includes('No analytics on the site') && report.html.includes('occasional tip'));
  assert.equal(alert.to, 'alerts@example.org');
  assert.match(alert.subject, /likely owner/);
  assert.equal(alert.replyTo, 'owner@acme.com.au');

  const lead = JSON.parse(fs.readFileSync(path.join(dataDir, 'sitecheck-leads.jsonl'), 'utf8').trim());
  assert.equal(lead.email, 'owner@acme.com.au');
  assert.equal(lead.outcome, 'small_fixes');
  assert.equal(lead.optin, true);
  assert.equal(lead.ownerSignal, 'same-domain');
});

test('the same domain within 24h reuses the cached report (checker not called again)', async () => {
  const { svc, checkerCalls, clock } = harness();
  for (const email of ['a@x.com', 'b@y.com']) {
    const { sessionId } = await svc.start({ ...good, email });
    const { jobId } = await svc.verify({ sessionId, code: '123456' });
    const out = await svc.status(jobId, { wait: true });
    assert.equal(out.status, 'done');
    if (email === 'b@y.com') assert.equal(out.cached, true);
  }
  assert.equal(checkerCalls.length, 1);
  clock.t += 25 * 3600 * 1000;
  const { sessionId } = await svc.start({ ...good, email: 'c@z.com' });
  await svc.status((await svc.verify({ sessionId, code: '123456' })).jobId, { wait: true });
  assert.equal(checkerCalls.length, 2);
});

test('unreachable sites are not cached', async () => {
  const { svc, checkerCalls } = harness({
    fetchImpl: async (_u, init) => {
      checkerCalls_push(init);
      return { status: 200, ok: true, json: async () => ({ ...REPORT, status: 'unreachable', outcome: 'not_enough_data', findings: [] }) };
    },
  });
  function checkerCalls_push() {}
  for (const email of ['a@x.com', 'b@y.com']) {
    const { sessionId } = await svc.start({ ...good, email });
    const out = await svc.status((await svc.verify({ sessionId, code: '123456' })).jobId, { wait: true });
    assert.equal(out.cached, false);
    assert.equal(out.recommendation.headline, "We couldn't check everything");
  }
});

test('checker busy (429) is retried; checker down becomes a friendly error', async () => {
  let calls = 0;
  const busy = harness({
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) return { status: 429, ok: false, json: async () => ({ code: 'busy' }) };
      return { status: 200, ok: true, json: async () => REPORT };
    },
  });
  const a = await busy.svc.start(good);
  const out = await busy.svc.status((await busy.svc.verify({ sessionId: a.sessionId, code: '123456' })).jobId, { wait: true });
  assert.equal(out.status, 'done');
  assert.equal(calls, 3);

  const down = harness({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
  const b = await down.svc.start(good);
  const out2 = await down.svc.status((await down.svc.verify({ sessionId: b.sessionId, code: '123456' })).jobId, { wait: true });
  assert.equal(out2.status, 'error');
  assert.match(out2.error, /temporarily unavailable/);
  assert.ok(!('report' in out2));
});

test('garbage from the checker is treated as an error, not shown', async () => {
  const { svc } = harness({ fetchImpl: async () => ({ status: 200, ok: true, json: async () => ({ hello: 'world' }) }) });
  const a = await svc.start(good);
  const out = await svc.status((await svc.verify({ sessionId: a.sessionId, code: '123456' })).jobId, { wait: true });
  assert.equal(out.status, 'error');
});

test('unknown job ids 404', async () => {
  const { svc } = harness();
  await assert.rejects(svc.status('nope'), (e) => e.code === 'not_found' && e.status === 404);
});

test('report email escapes everything that came from the scanned site', () => {
  const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  const report = {
    ...REPORT, platform: evil, good: [evil], notes: [evil], notTested: [{ check: evil, reason: evil }],
    findings: [{ id: 'x', group: 'findability', severity: 'medium', title: evil, detail: evil, evidence: evil }],
  };
  const html = renderReportEmail({ domain: evil, report, recommendation: buildRecommendation(report), optin: false });
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('booking prominence follows the outcome, in copy and in the report email', () => {
  const rec = (outcome, status) => buildRecommendation({ outcome, status, groupsAffected: [] });
  assert.equal(rec('setup_scale').booking, 'primary');
  assert.equal(rec('rebuild_signal').booking, 'primary');
  assert.equal(rec('small_fixes').booking, 'secondary');
  assert.equal(rec('nothing_major').booking, 'secondary');
  assert.equal(rec('not_enough_data', 'blocked').booking, 'none');

  const html = (outcome, status) => renderReportEmail({ domain: 'example.com', report: REPORT, recommendation: rec(outcome, status), optin: false });
  const cal = 'cal.daintytrading.com';
  assert.ok(html('setup_scale').includes(cal) && html('setup_scale').includes('Book a free call &rarr;'));
  assert.ok(html('small_fixes').includes(cal) && html('small_fixes').includes('Rather talk it through?'));
  assert.ok(!html('not_enough_data', 'blocked').includes(cal));
  assert.ok(html('setup_scale').includes('Website_Ideas=example.com%20-%20'));
});

test('recommendation copy follows the pricing rules', () => {
  const small = buildRecommendation({ outcome: 'small_fixes', groupsAffected: [] });
  assert.ok(!/AUD|USD|\$/.test(small.body), 'small fixes must not show a price');
  const setup = buildRecommendation({ outcome: 'setup_scale', groupsAffected: ['findability', 'measurement'] });
  assert.match(setup.body, /3,900 AUD \(2,700 USD\)/);
  assert.match(setup.body, /Being found/);
  const rebuild = buildRecommendation({ outcome: 'rebuild_signal' });
  assert.match(rebuild.body, /6,900 AUD \(4,950 USD\)/);
  assert.match(rebuild.headline, /recommend a rebuild/);
  assert.match(buildRecommendation({ outcome: 'not_enough_data', status: 'blocked' }).body, /bot protection/);
  assert.match(buildRecommendation({ outcome: 'not_enough_data', status: 'opted_out' }).body, /robots\.txt/);
  assert.ok(!/AUD|USD/.test(buildRecommendation({ outcome: 'nothing_major' }).body));
});

test('recommendation wording reads correctly on a web page too (the same text is shown on screen and emailed)', () => {
  const cases = [
    { outcome: 'nothing_major' }, { outcome: 'small_fixes' }, { outcome: 'setup_scale', groupsAffected: ['findability'] },
    { outcome: 'rebuild_signal' }, { outcome: 'not_enough_data', status: 'blocked' },
    { outcome: 'not_enough_data', status: 'unreachable' }, { outcome: 'not_enough_data', status: 'opted_out' },
    { outcome: 'not_enough_data', status: 'partial' },
  ];
  for (const c of cases) {
    const r = buildRecommendation(c);
    assert.ok(!/\breply\b|this email/i.test(r.body), `"${c.outcome}/${c.status}" mentions replying/email: ${r.body}`);
  }
});

test('rebuild signals are flagged in the lead alert for Andrew', async () => {
  const rebuild = { ...REPORT, outcome: 'rebuild_signal', rebuildSignals: ['eol_software'] };
  const { svc, emails } = harness({ fetchImpl: async () => ({ status: 200, ok: true, json: async () => rebuild }) });
  const a = await svc.start(good);
  await svc.status((await svc.verify({ sessionId: a.sessionId, code: '123456' })).jobId, { wait: true });
  await settle();
  const alert = emails.find((m) => m.subject.startsWith('[Site check'));
  assert.match(alert.subject, /REBUILD SIGNAL/);
  assert.match(alert.html, /Review by hand/);
});

// ---- abuse resistance (from the independent security review) ---------------------------------

test('canonicalEmailKey collapses plus-tags, Gmail dots and googlemail.com', () => {
  const { canonicalEmailKey: k } = require('../lib/sitecheck');
  assert.equal(k('v.ic.tim+1@gmail.com'), 'victim@gmail.com');
  assert.equal(k('VICTIM+spam@googlemail.com'), 'victim@gmail.com');
  assert.equal(k('a.b+c@example.com'), 'a.b@example.com');     // dots only matter (are ignored) on Gmail
  assert.equal(k('+x@example.com'), '+x@example.com');          // a leading + is part of the name
});

test('plus-addressed and dotted variants of one Gmail mailbox share one daily limit', async () => {
  const { svc } = harness();
  const variants = ['victim@gmail.com', 'v.ictim@gmail.com', 'victim+1@gmail.com'];
  for (const email of variants) await svc.start({ ...good, email, domain: 'site' + variants.indexOf(email) + '.com' });
  await assert.rejects(svc.start({ ...good, email: 'vi.ctim+zzz@googlemail.com', domain: 'other.com' }), (e) => e.code === 'email_limit');
});

test('a global hourly cap on code emails (start and resend both count)', async () => {
  const { svc, emails, clock } = harness({ hourlyCodeCap: 3 });
  const a = await svc.start({ ...good, email: 'a@x.com' });
  await svc.start({ ...good, email: 'b@x.com' });
  clock.t += 61000;
  await svc.resend({ sessionId: a.sessionId });                 // third code email
  await assert.rejects(svc.start({ ...good, email: 'c@x.com' }), (e) => e.code === 'busy' && e.status === 503);
  clock.t += 61000;
  await assert.rejects(svc.resend({ sessionId: a.sessionId }), (e) => e.code === 'busy');
  assert.equal(emails.length, 3);
  clock.t += 3600 * 1000;
  await svc.start({ ...good, email: 'c@x.com' });               // window has passed
});

test('one visitor (IP) cannot use up the day: 5 verified checks then a friendly stop', async () => {
  const { svc } = harness({ ipDailyChecks: 2 });
  for (let i = 0; i < 2; i += 1) {
    const s = await svc.start({ ...good, email: `p${i}@x.com`, domain: `d${i}.com`, ip: '203.0.113.5' });
    await svc.verify({ sessionId: s.sessionId, code: '123456' });
  }
  const s3 = await svc.start({ ...good, email: 'p3@x.com', domain: 'd3.com', ip: '203.0.113.5' });
  await assert.rejects(svc.verify({ sessionId: s3.sessionId, code: '123456' }), (e) => e.code === 'ip_limit' && /contact form/.test(e.message));
  const other = await svc.start({ ...good, email: 'p4@x.com', domain: 'd4.com', ip: '203.0.113.6' });
  await svc.verify({ sessionId: other.sessionId, code: '123456' });   // a different visitor is unaffected
});

test('simultaneous requests for the same domain share one check', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const { svc } = harness({
    fetchImpl: async () => { calls += 1; await gate; return { status: 200, ok: true, json: async () => REPORT }; },
  });
  const jobs = [];
  for (const email of ['a@x.com', 'b@y.com', 'c@z.com']) {
    const s = await svc.start({ ...good, email, ip: `198.51.100.${jobs.length + 1}` });
    jobs.push((await svc.verify({ sessionId: s.sessionId, code: '123456' })).jobId);
  }
  release();
  const results = await Promise.all(jobs.map((id) => svc.status(id, { wait: true })));
  assert.deepEqual(results.map((r) => r.status), ['done', 'done', 'done']);
  assert.equal(calls, 1);
});

test('when sessions are full new requests are turned away, live ones are not evicted', async () => {
  const { svc } = harness({ sessionMax: 2 });
  const a = await svc.start({ ...good, email: 'a@x.com' });
  const b = await svc.start({ ...good, email: 'b@x.com' });
  await assert.rejects(svc.start({ ...good, email: 'c@x.com' }), (e) => e.code === 'busy' && e.status === 503);
  assert.ok(svc._state.sessions.has(a.sessionId) && svc._state.sessions.has(b.sessionId));
});

test('an oversized or absurd report from the checker is rejected, not stored or emailed', async () => {
  const huge = { ...REPORT, good: ['x'.repeat(300 * 1024)] };
  const many = { ...REPORT, findings: Array.from({ length: 101 }, (_, i) => ({ ...REPORT.findings[0], id: 'f' + i })) };
  for (const bad of [huge, many]) {
    const { svc, emails } = harness({ fetchImpl: async () => ({ status: 200, ok: true, json: async () => bad }) });
    const s = await svc.start(good);
    const out = await svc.status((await svc.verify({ sessionId: s.sessionId, code: '123456' })).jobId, { wait: true });
    assert.equal(out.status, 'error');
    await settle();
    assert.equal(emails.filter((m) => m.subject.startsWith('Your site check for')).length, 0);
  }
});

test('health reflects the checker', async () => {
  assert.deepEqual(await harness().svc.health(), { ok: true });
  assert.deepEqual(await harness({ fetchImpl: async () => { throw new Error('x'); } }).svc.health(), { ok: false });
});
