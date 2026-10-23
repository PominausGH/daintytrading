'use strict';
const test = require('node:test');
const assert = require('node:assert');
const support = require('../lib/support-alerts');
const { handleUrgentEmail, isUrgentSubject } = require('../lib/urgent-email');
const { createMonitor, registeredDomain, FAILS_TO_ALERT } = require('../lib/uptime-monitor');
const { sendPush } = require('../lib/pushover');

// Sydney is UTC+11 in October (AEDT).
const syd = (iso) => new Date(new Date(iso + '+11:00').toISOString());
const TUE_10AM = syd('2026-10-20T10:00:00');
const TUE_8PM = syd('2026-10-20T20:00:00');
const TUE_11PM = syd('2026-10-20T23:00:00');
const SAT_10AM = syd('2026-10-24T10:00:00');

const scale = { name: 'Scale Co', plan: 'scale', care: true, emails: ['boss@scale.com'], domains: ['scale.com'], sites: [{ url: 'https://scale.com/', expect: 'Scale Co' }] };
const care = { name: 'Care Co', plan: 'care', care: true, domains: ['care.com.au'], sites: ['https://care.com.au/'] };
const seoOnly = { name: 'SEO Co', plan: 'growth', care: false, domains: ['seo.com'], sites: ['https://seo.com/'] };

test('priority follows the published response times', () => {
  assert.strictEqual(support.priorityFor(scale, TUE_10AM), 2);
  assert.strictEqual(support.priorityFor(scale, TUE_8PM), 2);
  assert.strictEqual(support.priorityFor(scale, SAT_10AM), 2);
  assert.strictEqual(support.priorityFor(scale, TUE_11PM), 0, 'nothing wakes anyone 10pm-7am');
  assert.strictEqual(support.priorityFor(care, TUE_10AM), 1);
  assert.strictEqual(support.priorityFor(care, TUE_8PM), 0);
  assert.strictEqual(support.priorityFor(care, SAT_10AM), 0);
  assert.strictEqual(support.priorityFor(seoOnly, TUE_10AM), 0, 'no Care, no urgent cover');
  assert.strictEqual(support.priorityFor(null, TUE_10AM), 0);
});

test('sender matching: exact email first, then domain', () => {
  const clients = [scale, care];
  assert.strictEqual(support.findClientBySender('Boss@Scale.com', clients), scale);
  assert.strictEqual(support.findClientBySender('office@care.com.au', clients), care);
  assert.strictEqual(support.findClientBySender('x@gmail.com', clients), null);
});

test('URGENT subject detection ignores replies', () => {
  assert.ok(isUrgentSubject('URGENT: site down'));
  assert.ok(isUrgentSubject('  urgent site hacked'));
  assert.ok(!isUrgentSubject('Re: URGENT: site down'));
  assert.ok(!isUrgentSubject('Not urgent'));
});

test('urgent email: client on Scale wakes, stranger does not', async () => {
  const sent = [];
  const deps = { clients: [scale], now: TUE_8PM, sendPush: async (p) => { sent.push(p); return { ok: true }; } };
  await handleUrgentEmail({ from: 'boss@scale.com', subject: 'URGENT site down', text: 'help' }, deps);
  await handleUrgentEmail({ from: 'spam@x.com', subject: 'URGENT read this', text: '' }, deps);
  await handleUrgentEmail({ from: 'boss@scale.com', subject: 'urgent', text: '', autoSubmitted: 'auto-replied' }, deps);
  await handleUrgentEmail({ from: 'boss@scale.com', subject: 'Question', text: '' }, deps);
  assert.deepStrictEqual(sent.map((p) => p.priority), [2, 0]);
});

function fakeFetch(responses) {
  return async (url) => {
    const r = responses[url];
    if (r instanceof Error) throw r;
    return { status: r.status, text: async () => r.body || '' };
  };
}

test('monitor: alerts once after 3 failures, then once on recovery; skips non-Care', async () => {
  const responses = { 'https://scale.com/': { status: 200, body: '<h1>Scale Co</h1>' }, 'https://seo.com/': new Error('ECONNREFUSED') };
  const sent = [];
  const m = createMonitor({
    fetchImpl: fakeFetch(responses),
    sendPush: async (p) => { sent.push(p); return { ok: true }; },
    loadClients: () => [scale, seoOnly],
    now: () => TUE_10AM,
  });
  await m.tick();
  assert.strictEqual(sent.length, 0);
  responses['https://scale.com/'] = { status: 503 };
  for (let i = 0; i < FAILS_TO_ALERT + 2; i++) await m.tick();
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].title, /^DOWN: Scale Co/);
  assert.strictEqual(sent[0].priority, 2);
  responses['https://scale.com/'] = { status: 200, body: 'Scale Co' };
  await m.tick();
  assert.strictEqual(sent.length, 2);
  assert.match(sent[1].title, /^Back up/);
  assert.ok(!m.state.has('https://seo.com/'), 'sites without Care are not watched');
});

test('monitor: missing expected text counts as down (defacement)', async () => {
  const sent = [];
  const m = createMonitor({
    fetchImpl: fakeFetch({ 'https://scale.com/': { status: 200, body: 'Hacked by someone' } }),
    sendPush: async (p) => { sent.push(p); return { ok: true }; },
    loadClients: () => [scale],
    now: () => TUE_10AM,
  });
  for (let i = 0; i < FAILS_TO_ALERT; i++) await m.tick();
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].message, /"Scale Co" is missing/);
});

test('monitor: a 429 (rate limited) is up, not an outage', async () => {
  const sent = [];
  const m = createMonitor({
    fetchImpl: fakeFetch({ 'https://scale.com/': { status: 429, body: 'Too Many Requests' } }),
    sendPush: async (p) => { sent.push(p); return { ok: true }; },
    loadClients: () => [scale],
    now: () => TUE_10AM,
  });
  for (let i = 0; i < FAILS_TO_ALERT + 2; i++) await m.tick();
  assert.strictEqual(sent.length, 0);
});

test('registered domain handles .com.au', () => {
  assert.strictEqual(registeredDomain('https://www.care.com.au/x'), 'care.com.au');
  assert.strictEqual(registeredDomain('https://shop.scale.com/'), 'scale.com');
});

test('pushover: no credentials means no request; emergency adds retry/expire', async () => {
  let called = false;
  const r = await sendPush({ title: 't', message: 'm' }, { env: {}, fetchImpl: async () => { called = true; } });
  assert.strictEqual(r.skipped, 'not_configured');
  assert.ok(!called);
  let form;
  await sendPush({ title: 't', message: 'm', priority: 2 }, {
    env: { PUSHOVER_APP_TOKEN: 'a', PUSHOVER_USER_KEY: 'u' },
    fetchImpl: async (_u, opts) => { form = opts.body; return { ok: true }; },
  });
  assert.strictEqual(form.get('priority'), '2');
  assert.strictEqual(form.get('retry'), '60');
  assert.strictEqual(form.get('expire'), '10800');
});
