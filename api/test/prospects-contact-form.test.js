'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

// The contact-form lane: prospects with no email address but a usable enquiry form. Nothing is
// ever submitted to their form from here; Andrew pastes the message himself and records it.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prospects-form-'));
process.env.PROSPECTS_REPORTS_DIR = path.join(root, 'reports');
process.env.DATA_DIR = path.join(root, 'data');
process.env.ADMIN_SESSION_SECRET = 'test-secret-not-real';
delete process.env.PROSPECTS_RATE_LIMIT_PER_WEEK;

const aiosPath = require.resolve('../lib/prospects-aios');
require.cache[aiosPath] = {
  id: aiosPath, filename: aiosPath, loaded: true,
  exports: { draftProspectEmail: async () => ({ subject: 'broken link on your quote page', body: 'Hi there,\n\nOne of your links is broken.', confidence: 0.8 }) },
};
const emailsSent = [];
const emailPath = require.resolve('../lib/email');
require.cache[emailPath] = {
  id: emailPath, filename: emailPath, loaded: true,
  exports: { sendEmail: async (m) => { emailsSent.push(m); return { success: true }; } },
};

const config = require('../lib/config');
const store = require('../lib/prospects-store');
const { createSessionToken } = require('../lib/auth');
const router = require('../routes/prospects');
store.setSiteCheck(null);

const DATA = process.env.DATA_DIR;
const SENT_FILE = path.join(DATA, 'prospects-sent.json');
const RUN = 'run-form';
const HEADER = 'url,business_name,contact_email,platform,score,findings_count,high_severity_count,status,error_message,report_path,pdf_path,json_path,vertical,contact_form_url\n';
const dir = path.join(process.env.PROSPECTS_REPORTS_DIR, RUN);
fs.mkdirSync(dir, { recursive: true });
const prospects = [
  { slug: 'india-com-au', url: 'https://india.com.au/', name: 'India Blinds', email: '', form: 'https://india.com.au/contact-us/' },
  { slug: 'juliet-com-au', url: 'https://juliet.com.au/', name: 'Juliet Law', email: '', form: '' },
  { slug: 'kilo-com-au', url: 'https://www.kilo.com.au/', name: 'Kilo Shutters', email: '', form: 'https://www.kilo.com.au/contact' },
];
fs.writeFileSync(path.join(dir, 'summary.csv'), HEADER + prospects.map((p) =>
  `${p.url},${p.name},${p.email},wordpress,60,1,0,ok,,,,${path.join(dir, p.slug + '.json')},blinds,${p.form}\n`).join(''));
for (const p of prospects) {
  fs.writeFileSync(path.join(dir, p.slug + '.json'), JSON.stringify({
    site_url: p.url, platform: 'wordpress', contact_email: '',
    findings: [{ category: 'broken_link', severity: 'medium', message: 'Broken/unreachable link: ' + p.url + 'old', url: p.url }],
  }));
}

function serve() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/prospects', router);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({
      base: `http://127.0.0.1:${server.address().port}/api/admin/prospects`,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}
const cookie = { cookie: `dt_admin_session=${encodeURIComponent(createSessionToken())}` };
const call = (base, method, p, body) => fetch(base + p, {
  method, headers: { 'content-type': 'application/json', ...cookie }, body: body === undefined ? undefined : JSON.stringify(body),
});

test('the weekly cap defaults to 50', () => {
  assert.equal(config.prospectsRateLimitPerWeek, 50);
});

test('no email but a contact form is eligible; no email and no form is not', async () => {
  await store.buildDraft(RUN, 'india-com-au');
  await store.buildDraft(RUN, 'kilo-com-au');
  const q = store.buildQueue();
  assert.equal(q.counts.noEmail, 1, 'Juliet has neither');
  assert.equal(q.counts.viaForm, 2);
  const india = q.items.find((i) => i.slug === 'india-com-au');
  assert.equal(india.channel, 'form');
  assert.equal(india.to, null);
  assert.equal(india.contactFormUrl, 'https://india.com.au/contact-us/');
  assert.match(india.body, /You can reply to hello@telaloom\.com\. If you'd rather not hear from us, say so/);
});

test('recording a form send never emails anyone, logs the channel, and blocks a second one', async () => {
  const s = await serve();
  try {
    const r = await call(s.base, 'POST', `/india-com-au/sent-via-form?run=${RUN}`, { subject: 'broken link on your quote page', formUrl: 'https://india.com.au/contact-us/' });
    assert.equal(r.status, 200);
    assert.equal(emailsSent.length, 0);
    const rec = store.getSentRecord(RUN, 'india-com-au');
    assert.equal(rec.channel, 'form');
    assert.equal(rec.to, null);
    assert.equal(rec.formUrl, 'https://india.com.au/contact-us/');
    assert.equal(rec.siteDomain, 'india.com.au');
    assert.equal(store.countSentInLastDays(7), 1, 'counts toward the weekly cap');
    const again = await call(s.base, 'POST', `/india-com-au/sent-via-form?run=${RUN}`, { subject: 'x' });
    assert.equal(again.status, 409);
    assert.ok(!store.buildQueue().items.some((i) => i.slug === 'india-com-au'), 'drops out of the queue');
  } finally {
    await s.close();
  }
});

test('a follow-up through the form is refused until due, and carries the reply/opt-out line', async () => {
  const s = await serve();
  try {
    const early = await call(s.base, 'POST', `/india-com-au/sent-via-form?run=${RUN}`, { subject: 'Re: x', followUp: true });
    assert.equal(early.status, 409);
    const log = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
    log[`${RUN}:india-com-au`].sentAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(SENT_FILE, JSON.stringify(log));
    const fu = store.buildFollowUp(RUN, 'india-com-au');
    assert.equal(fu.state, 'due');
    assert.equal(fu.channel, 'form');
    assert.match(fu.body, /You can reply to hello@telaloom\.com/);
    const ok = await call(s.base, 'POST', `/india-com-au/sent-via-form?run=${RUN}`, { subject: fu.subject, followUp: true });
    assert.equal(ok.status, 200);
    assert.equal(emailsSent.length, 0);
  } finally {
    await s.close();
  }
});

test('a reply from the business\'s own domain is matched to the form send (www ignored)', () => {
  store.markSent(RUN, 'kilo-com-au', { to: null, subject: 's', siteDomain: 'www.kilo.com.au', channel: 'form', formUrl: 'https://www.kilo.com.au/contact' });
  const r = store.applyInboundReply('info@kilo.com.au', 'replied');
  assert.equal(r.matched, 1);
  assert.ok(store.getSentRecord(RUN, 'kilo-com-au').repliedAt);
  assert.equal(store.applyInboundReply('someone@gmail.com', 'replied').matched, 0, 'a free-mail sender never matches by domain');
});

test('the form route respects the weekly cap', async () => {
  const log = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
  const now = new Date().toISOString();
  for (let i = 0; i < 60; i += 1) log[`run-filler:f${i}`] = { sentAt: now, to: `a${i}@x.com.au`, subject: 's', siteDomain: `x${i}.com.au` };
  fs.writeFileSync(SENT_FILE, JSON.stringify(log));
  const s = await serve();
  try {
    const r = await call(s.base, 'POST', `/juliet-com-au/sent-via-form?run=${RUN}`, { subject: 's' });
    assert.equal(r.status, 429);
  } finally {
    await s.close();
  }
});
