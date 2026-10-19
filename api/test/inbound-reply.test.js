'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

// Scratch dirs, set before the store loads (each test file is its own process).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inbound-reply-'));
process.env.PROSPECTS_REPORTS_DIR = path.join(root, 'reports');
process.env.DATA_DIR = path.join(root, 'data');

const store = require('../lib/prospects-store');
const { classifyReply, stripQuoted } = require('../lib/reply-classifier');
const { buildRouter } = require('../routes/inbound-reply');

const SENT_FILE = path.join(process.env.DATA_DIR, 'prospects-sent.json');
const SUPPRESSION_FILE = path.join(process.env.DATA_DIR, 'prospects-suppression.json');
const AUDIT_FILE = path.join(process.env.DATA_DIR, 'inbound-replies.jsonl');
const DAY = 24 * 60 * 60 * 1000;
const SECRET = 'test-secret-123';

// ---- classifier ------------------------------------------------------------------------------

const OUR_EMAIL_QUOTED = '\n\nOn Mon, 13 Oct 2026 at 9:02 am, Telaloom <hello@telaloom.com> wrote:\n> Hi Acme,\n> One of your links is broken.\n> Unsubscribe: https://telaloom.com/unsubscribe';

const CASES = [
  ['plain reply', { subject: 'Re: broken link on your shutters page', text: 'Thanks, how much would that cost to fix?' }, 'replied'],
  ['remove me', { subject: 'Re: broken link', text: 'Please remove me from your list.' }, 'opted_out'],
  ['not interested', { subject: 'Re: broken link', text: 'Not interested, thanks' }, 'opted_out'],
  ['STOP', { subject: 'Re: broken link', text: 'STOP' }, 'opted_out'],
  ['Stop. on its own line', { text: 'Hi\nStop.\n' }, 'opted_out'],
  ['no thanks', { text: 'No thanks.' }, 'opted_out'],
  ['no, thank', { text: 'no, thank you mate' }, 'opted_out'],
  ['no thank you', { text: 'No thank you' }, 'opted_out'],
  ['unsubscribe in subject', { subject: 'Unsubscribe', text: '' }, 'opted_out'],
  ['opt-out', { text: 'I would like to opt-out' }, 'opted_out'],
  ['stop emailing', { text: 'Please stop emailing me' }, 'opted_out'],
  ["don't contact", { text: "Don't contact us again" }, 'opted_out'],
  ['take us off', { text: 'take us off your list' }, 'opted_out'],
  ['stop inside a sentence is a reply', { text: "Can you stop by on Tuesday?" }, 'replied'],
  ['unsubscribe only in > quote', { text: 'Sounds good, call me.\n> Unsubscribe: https://telaloom.com/u' }, 'replied'],
  ['unsubscribe only under On..wrote:', { text: 'Yes please send a quote.' + OUR_EMAIL_QUOTED }, 'replied'],
  ['On..wrote: wrapped over two lines', { text: 'Interested.\n\nOn Mon, 13 Oct 2026 at 9:02 am, Telaloom <hello@telaloom.com>\nwrote:\nunsubscribe here' }, 'replied'],
  ['Original Message block', { text: 'Ok call me\n-----Original Message-----\nunsubscribe' }, 'replied'],
  ['From: header block', { text: 'Ok call me\nFrom: Telaloom\nunsubscribe' }, 'replied'],
  ['Outlook underscore rule', { text: 'Ok\n________________________________\nunsubscribe' }, 'replied'],
  ['Sent from my iPhone', { text: 'Ok\nSent from my iPhone\nunsubscribe' }, 'replied'],
  ['out-of-office subject', { subject: 'Out of Office: back Monday', text: 'not interested' }, 'ignored'],
  ['Automatic reply subject', { subject: 'Automatic reply: broken link', text: 'Hi' }, 'ignored'],
  ['Re: auto-reply subject', { subject: 'RE: Auto-Reply', text: 'Hi' }, 'ignored'],
  ['undeliverable', { subject: 'Undeliverable: broken link', text: '' }, 'ignored'],
  ['Auto-Submitted: auto-replied', { auto_submitted: 'auto-replied', text: 'Please remove me' }, 'ignored'],
  ['Auto-Submitted: no is a person', { auto_submitted: 'No', text: 'Sure' }, 'replied'],
  ['Precedence: bulk', { precedence: 'Bulk', text: 'hello' }, 'ignored'],
  ['Precedence: auto_reply', { precedence: 'auto_reply', text: 'hello' }, 'ignored'],
  ['X-Autoreply set', { x_autoreply: 'yes', text: 'hello' }, 'ignored'],
];

for (const [name, input, expected] of CASES) {
  test(`classifyReply: ${name} -> ${expected}`, () => assert.equal(classifyReply(input), expected));
}

test('stripQuoted keeps the reply and drops the quote', () => {
  assert.equal(stripQuoted('Yes\r\n> quoted\r\nmore').trim(), 'Yes\nmore');
  assert.equal(stripQuoted('Yes' + OUR_EMAIL_QUOTED).trim(), 'Yes');
});

test('normalizeAddress handles Name <ADDR> and rejects junk', () => {
  assert.equal(store.normalizeAddress('Bob Smith <Bob@Bravo.COM.au>'), 'bob@bravo.com.au');
  assert.equal(store.normalizeAddress('  info@bravo.com.au '), 'info@bravo.com.au');
  assert.equal(store.normalizeAddress('not an address'), null);
  assert.equal(store.normalizeAddress(''), null);
  assert.equal(store.normalizeAddress(undefined), null);
});

// ---- route -----------------------------------------------------------------------------------

function serve(secret) {
  const app = express();
  app.use('/api/inbound-reply', buildRouter({ secret }));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}/api/inbound-reply`,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

const post = (url, body, auth = `Bearer ${SECRET}`) => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
  body: JSON.stringify(body),
});

// Sent records written straight to the log, backdated so their follow-ups are due.
function seedSent(entries) {
  fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
  const log = {};
  for (const [key, to, siteDomain] of entries) {
    log[key] = { sentAt: new Date(Date.now() - 10 * DAY).toISOString(), to, subject: 'broken link', domain: to.split('@')[1], siteDomain, variant: 'A' };
  }
  fs.writeFileSync(SENT_FILE, JSON.stringify(log));
}
const record = (key) => JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'))[key];
const suppression = () => (fs.existsSync(SUPPRESSION_FILE) ? JSON.parse(fs.readFileSync(SUPPRESSION_FILE, 'utf8')) : []);

seedSent([
  ['run-1:acme-com-au', 'acmeshutters@gmail.com', 'acme.com.au'],
  ['run-1:bravo-com-au', 'Info@Bravo.com.au', 'bravo.com.au'],
  ['run-1:charlie-com-au', 'hi@charlie.com.au', 'charlie.com.au'],
]);

test('unset secret fails closed with 503', async () => {
  const s = await serve('');
  const r = await post(s.url, { from: 'hi@charlie.com.au', text: 'STOP' });
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'not_configured' });
  await s.close();
  assert.equal(record('run-1:charlie-com-au').optedOutAt, undefined);
});

test('wrong or missing secret is 401 and changes nothing', async () => {
  const s = await serve(SECRET);
  assert.equal((await post(s.url, { from: 'hi@charlie.com.au', text: 'STOP' }, 'Bearer nope')).status, 401);
  assert.equal((await post(s.url, { from: 'hi@charlie.com.au', text: 'STOP' }, null)).status, 401);
  assert.equal((await post(s.url, { from: 'hi@charlie.com.au', text: 'STOP' }, SECRET)).status, 401);
  await s.close();
  assert.equal(record('run-1:charlie-com-au').optedOutAt, undefined);
  assert.ok(!suppression().includes('hi@charlie.com.au'));
});

test('missing or invalid from is 400', async () => {
  const s = await serve(SECRET);
  assert.equal((await post(s.url, { text: 'hi' })).status, 400);
  assert.equal((await post(s.url, { from: 'nobody', text: 'hi' })).status, 400);
  await s.close();
});

test('a real reply marks the prospect replied and the follow-up stops', async () => {
  assert.equal(store.followUpState(record('run-1:acme-com-au')), 'due');
  const s = await serve(SECRET);
  const r = await post(s.url, { from: 'Acme Shutters <AcmeShutters@Gmail.com>', subject: 'Re: broken link', text: 'How much to fix?' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { result: 'replied', matched: 1 });
  await s.close();
  const rec = record('run-1:acme-com-au');
  assert.ok(rec.repliedAt);
  assert.equal(rec.optedOutAt, undefined);
  assert.equal(store.followUpState(rec), 'replied');
  assert.ok(!store.listFollowUps().some((f) => f.slug === 'acme-com-au'));
  assert.ok(!suppression().includes('acmeshutters@gmail.com'));
});

test('an opt-out suppresses address + website, marks replied and blocks the follow-up (case-insensitive Name <ADDR>)', async () => {
  const s = await serve(SECRET);
  const r = await post(s.url, { from: 'Bob <INFO@BRAVO.COM.AU>', subject: 'Re: broken link', text: 'Please remove me from your list' + OUR_EMAIL_QUOTED });
  assert.deepEqual(await r.json(), { result: 'opted_out', matched: 1 });
  await s.close();
  const rec = record('run-1:bravo-com-au');
  assert.ok(rec.optedOutAt);
  assert.ok(rec.repliedAt);
  assert.equal(store.followUpState(rec), 'opted_out');
  assert.ok(suppression().includes('info@bravo.com.au'));
  assert.ok(suppression().includes('bravo.com.au'));
  assert.ok(store.isSuppressed('bravo.com.au'));
  assert.ok(!store.listFollowUps().some((f) => f.slug === 'bravo-com-au'));
});

test('an unmatched opt-out still suppresses the sender address', async () => {
  const s = await serve(SECRET);
  const r = await post(s.url, { from: 'stranger@delta.com.au', text: 'unsubscribe' });
  assert.deepEqual(await r.json(), { result: 'opted_out', matched: 0 });
  await s.close();
  assert.ok(suppression().includes('stranger@delta.com.au'));
  assert.ok(!suppression().includes('delta.com.au'), 'no domain suppression without a matched record');
});

test('an unmatched reply is no_match; a domain-only match does not count', async () => {
  const s = await serve(SECRET);
  const r = await post(s.url, { from: 'someone-else@charlie.com.au', text: 'Who is this?' });
  assert.deepEqual(await r.json(), { result: 'no_match', matched: 0 });
  await s.close();
  assert.equal(record('run-1:charlie-com-au').repliedAt, undefined);
});

test('an auto-reply is ignored and changes nothing', async () => {
  const s = await serve(SECRET);
  const r = await post(s.url, { from: 'hi@charlie.com.au', subject: 'Out of office', text: 'Away until Monday', auto_submitted: 'auto-replied' });
  assert.deepEqual(await r.json(), { result: 'ignored', matched: 0 });
  await s.close();
  const rec = record('run-1:charlie-com-au');
  assert.equal(rec.repliedAt, undefined);
  assert.equal(store.followUpState(rec), 'due');
});

test('a full-size body (8000 non-ASCII chars, over 16kb) is accepted', async () => {
  const s = await serve(SECRET);
  const r = await post(s.url, { from: 'hi@charlie.com.au', subject: 'Re: x', text: 'é€'.repeat(4000) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).result, 'replied');
  await s.close();
});

test('every handled call leaves a compact audit line', () => {
  const lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.length >= 5);
  for (const l of lines) {
    assert.deepEqual(Object.keys(l).sort(), ['at', 'from', 'matched', 'result', 'subject']);
    assert.ok(l.subject.length <= 120);
  }
  assert.ok(lines.some((l) => l.from === 'info@bravo.com.au' && l.result === 'opted_out'));
});
