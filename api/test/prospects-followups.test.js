'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Scratch dirs and a stubbed model, set before the store loads (each test file is its own process).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prospects-followups-'));
process.env.PROSPECTS_REPORTS_DIR = path.join(root, 'reports');
process.env.DATA_DIR = path.join(root, 'data');

const modelCalls = [];
const aiosPath = require.resolve('../lib/prospects-aios');
require.cache[aiosPath] = {
  id: aiosPath, filename: aiosPath, loaded: true,
  exports: { draftProspectEmail: async (a) => { modelCalls.push(a); return { subject: 'broken link on your shutters page', body: 'Hi Acme Shutters,\n\nOne of your links is broken.', confidence: 0.8 }; } },
};

const store = require('../lib/prospects-store');
const config = require('../lib/config');

const SENT_FILE = path.join(process.env.DATA_DIR, 'prospects-sent.json');
const SUPPRESSION_FILE = path.join(process.env.DATA_DIR, 'prospects-suppression.json');
const DAY = 24 * 60 * 60 * 1000;

function makeRun(run, prospects) {
  const dir = path.join(process.env.PROSPECTS_REPORTS_DIR, run);
  fs.mkdirSync(dir, { recursive: true });
  const header = 'url,business_name,contact_email,platform,score,findings_count,high_severity_count,status,error_message,report_path,pdf_path,json_path\n';
  fs.writeFileSync(path.join(dir, 'summary.csv'), header + prospects.map((p) =>
    `${p.url},${p.name},${p.email},wordpress,60,1,0,ok,,,,${path.join(dir, p.slug + '.json')}\n`).join(''));
  for (const p of prospects) {
    fs.writeFileSync(path.join(dir, p.slug + '.json'), JSON.stringify({
      site_url: p.url, platform: 'wordpress', contact_email: p.email,
      findings: [{ category: 'broken_link', severity: 'medium', message: 'Broken/unreachable link: ' + p.url + 'old', url: p.url }],
    }));
  }
}
const backdate = (run, slug, days, field = 'sentAt') => {
  const log = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
  const iso = new Date(Date.now() - days * DAY).toISOString();
  if (field === 'sentAt') log[`${run}:${slug}`].sentAt = iso; else log[`${run}:${slug}`].followUp.sentAt = iso;
  fs.writeFileSync(SENT_FILE, JSON.stringify(log));
};

makeRun('run-1', [
  { url: 'https://acme.com.au/', name: 'Acme Shutters', email: 'acmeshutters@gmail.com', slug: 'acme-com-au' },
  { url: 'https://bravo.com.au/', name: 'Bravo Blinds', email: 'info@bravo.com.au', slug: 'bravo-com-au' },
  { url: 'https://charlie.com.au/', name: 'Charlie Awnings', email: 'hi@charlie.com.au', slug: 'charlie-com-au' },
]);
makeRun('run-2', [{ url: 'https://www.acme.com.au/', name: 'Acme Shutters', email: 'acmeshutters@gmail.com', slug: 'acme-com-au' }]);

const send = (slug, email) => store.markSent('run-1', slug, {
  to: email, subject: 'broken link on your shutters page', domain: email.split('@')[1], siteDomain: store.siteDomainFor('run-1', slug), variant: 'A',
});

test('addBusinessDays skips weekends', () => {
  const iso = (d) => d.toISOString().slice(0, 10);
  assert.equal(iso(store.addBusinessDays('2026-10-12T03:00:00Z', 5)), '2026-10-19'); // Mon + 5 = next Mon
  assert.equal(iso(store.addBusinessDays('2026-10-16T03:00:00Z', 1)), '2026-10-19'); // Fri + 1 = Mon
  assert.equal(iso(store.addBusinessDays('2026-10-17T03:00:00Z', 1)), '2026-10-19'); // Sat + 1 = Mon
});

test('a follow-up is not due straight after the first email, and the window says when it will be', async () => {
  await store.buildDraft('run-1', 'acme-com-au'); // writes and saves the first email
  send('acme-com-au', 'acmeshutters@gmail.com');
  assert.equal(store.followUpState(store.getSentRecord('run-1', 'acme-com-au')), 'not_due');
  const fu = store.buildFollowUp('run-1', 'acme-com-au');
  assert.equal(fu.state, 'not_due');
  assert.equal(fu.subject, '');
  assert.match(fu.reason, /Follow-up is due on \d{4}-\d{2}-\d{2}, 5 working days after the first email/);
});

test('once due, the follow-up is a short fixed note: same greeting, Re: subject, no model call', () => {
  backdate('run-1', 'acme-com-au', 9);
  const calls = modelCalls.length;
  const fu = store.buildFollowUp('run-1', 'acme-com-au');
  assert.equal(fu.state, 'due');
  assert.equal(fu.to, 'acmeshutters@gmail.com');
  assert.equal(fu.subject, 'Re: broken link on your shutters page');
  assert.ok(fu.body.startsWith('Hi Acme Shutters,\n\nFollowing up on my earlier note'));
  assert.ok(fu.body.includes("just say so and I won't email again"));
  assert.ok(fu.body.endsWith(config.prospectsSignature));
  assert.equal(modelCalls.length, calls);
  assert.deepEqual(store.listFollowUps().map((f) => [f.slug, f.state, f.label]), [['acme-com-au', 'due', 'Acme Shutters']]);
});

test('the same business in a later run is still in cooldown, even though we wrote to a Gmail address', async () => {
  const d = await store.buildDraft('run-2', 'acme-com-au');
  assert.equal(d.status, 'cooldown');
});

test('a reply cancels the follow-up, and can be undone', () => {
  assert.ok(store.markReplied('run-1', 'acme-com-au', true).repliedAt);
  assert.equal(store.buildFollowUp('run-1', 'acme-com-au').state, 'replied');
  assert.equal(store.listFollowUps().length, 0);
  store.markReplied('run-1', 'acme-com-au', false);
  assert.equal(store.buildFollowUp('run-1', 'acme-com-au').state, 'due');
  assert.equal(store.markReplied('run-1', 'nobody', true), null);
});

test('sending the follow-up ends the sequence for good, past the cooldown too', async () => {
  const before = store.countSentInLastDays(7);
  store.markFollowUpSent('run-1', 'acme-com-au', { subject: 'Re: broken link on your shutters page' });
  assert.equal(store.countSentInLastDays(7), before + 1, 'a follow-up counts toward the weekly cap');
  const fu = store.buildFollowUp('run-1', 'acme-com-au');
  assert.equal(fu.state, 'done');
  assert.match(fu.reason, /Two emails is the limit/);
  backdate('run-1', 'acme-com-au', 200);
  backdate('run-1', 'acme-com-au', 190, 'followUp');
  const later = await store.buildDraft('run-2', 'acme-com-au');
  assert.equal(later.status, 'finished');
  assert.match(later.reason, /don't email them again/);
});

test('opting out suppresses the address and the website, never a shared mail domain', async () => {
  await store.buildDraft('run-1', 'bravo-com-au');
  send('bravo-com-au', 'owner.bravo@gmail.com');
  const out = store.optOut('run-1', 'bravo-com-au');
  assert.deepEqual(out.suppressed.sort(), ['bravo.com.au', 'owner.bravo@gmail.com']);
  const list = JSON.parse(fs.readFileSync(SUPPRESSION_FILE, 'utf8'));
  assert.ok(!list.includes('gmail.com'));
  assert.equal(store.isSuppressed('acmeshutters@gmail.com'), false, 'other Gmail prospects are unaffected');
  assert.equal(store.followUpState(store.getSentRecord('run-1', 'bravo-com-au')), 'opted_out');
  assert.equal((await store.buildDraft('run-1', 'bravo-com-au', { fresh: true })).status, 'suppressed');
  assert.deepEqual(store.optOut('run-1', 'bravo-com-au').suppressed, [], 'opting out twice adds nothing');
  assert.equal(store.optOut('run-1', 'nobody'), null);
});

test('rows and stats carry the sequence state', async () => {
  await store.buildDraft('run-1', 'charlie-com-au');
  send('charlie-com-au', 'hi@charlie.com.au');
  const rows = Object.fromEntries(store.getRunProspects('run-1').map((r) => [r.slug, r]));
  assert.equal(rows['acme-com-au'].followUpState, 'done');
  assert.equal(rows['bravo-com-au'].followUpState, 'opted_out');
  assert.equal(rows['charlie-com-au'].followUpState, 'not_due');
  assert.ok(rows['charlie-com-au'].followUpDueAt);
  const stats = store.outreachStats();
  assert.deepEqual(
    { sent: stats.sent, replied: stats.replied, optedOut: stats.optedOut, followUpsSent: stats.followUpsSent, followUpsDue: stats.followUpsDue },
    { sent: 3, replied: 0, optedOut: 1, followUpsSent: 1, followUpsDue: 0 },
  );
  assert.equal(stats.weeklyLimit, config.prospectsRateLimitPerWeek);
});
