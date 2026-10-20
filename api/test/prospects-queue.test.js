'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

// Scratch dirs, a stubbed model and a test admin secret, all set before anything loads (each test
// file is its own process). Nothing here sends email or calls the real model.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prospects-queue-'));
process.env.PROSPECTS_REPORTS_DIR = path.join(root, 'reports');
process.env.DATA_DIR = path.join(root, 'data');
process.env.ADMIN_SESSION_SECRET = 'test-secret-not-real';
delete process.env.PROSPECTS_GUARANTEE_LINE;

const AI_BODY = 'Hi there,\n\nOne of your links is broken.';
const LONG_BODY = Array.from({ length: 150 }, () => 'word').join(' ') + ' broken link';
const modelCalls = [];
const aiosPath = require.resolve('../lib/prospects-aios');
require.cache[aiosPath] = {
  id: aiosPath, filename: aiosPath, loaded: true,
  exports: {
    draftProspectEmail: async (a) => {
      modelCalls.push(a.businessName);
      return { subject: 'broken link on your shutters page', body: a.businessName === 'Golf Blinds' ? LONG_BODY : AI_BODY, confidence: 0.8 };
    },
  },
};

// If a send guard ever regresses, this records the attempt instead of emailing anyone.
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
// The router wires the live site checker; tests use none (audit findings only) unless a test sets one.
store.setSiteCheck(null);

const DATA = process.env.DATA_DIR;
const SENT_FILE = path.join(DATA, 'prospects-sent.json');
const DAY = 24 * 60 * 60 * 1000;
const HEADER = 'url,business_name,contact_email,platform,score,findings_count,high_severity_count,status,error_message,report_path,pdf_path,json_path\n';

function makeRun(run, prospects, ageDays) {
  const dir = path.join(process.env.PROSPECTS_REPORTS_DIR, run);
  fs.mkdirSync(dir, { recursive: true });
  const summary = path.join(dir, 'summary.csv');
  fs.writeFileSync(summary, HEADER + prospects.map((p) =>
    `${p.url},${p.name},${p.email || ''},wordpress,60,1,0,ok,,,,${path.join(dir, p.slug + '.json')}\n`).join(''));
  for (const p of prospects) {
    fs.writeFileSync(path.join(dir, p.slug + '.json'), JSON.stringify({
      site_url: p.url, platform: 'wordpress', contact_email: p.email || '',
      findings: [{ category: 'broken_link', severity: 'medium', message: 'Broken/unreachable link: ' + p.url + 'old', url: p.url }],
    }));
  }
  const t = new Date(Date.now() - ageDays * DAY);
  fs.utimesSync(summary, t, t);
}

const p = (slug, name, email) => ({ url: `https://${slug.replace(/-com-au$/, '')}.com.au/`, name, email, slug });

// run-old is the earlier batch; run-new the latest. Acme is in both.
makeRun('run-old', [
  p('acme-com-au', 'Acme Old Name', 'old@acme.com.au'),
  p('delta-com-au', 'Delta Shutters', 'info@delta.com.au'),
  p('echo-com-au', 'Echo Awnings', ''),
], 10);
makeRun('run-new', [
  { url: 'https://www.acme.com.au/', name: 'Acme Shutters', email: 'info@acme.com.au', slug: 'acme-com-au' },
  p('bravo-com-au', 'Bravo Blinds', 'info@bravo.com.au'),
  p('charlie-com-au', 'Charlie Awnings', 'hi@charlie.com.au'),
  p('foxtrot-com-au', 'Foxtrot Shutters', 'foxtrotshutters@gmail.com'),
  p('golf-com-au', 'Golf Blinds', 'info@golf.com.au'),
  p('hotel-com-au', 'Hotel Blinds', 'info@hotel.com.au'),
], 1);

// Delta: emailed from run-old. Foxtrot: emailed 20 days ago from a batch no longer on disk (cooldown
// by website). Bravo: on the suppression list. Charlie: skipped.
store.markSent('run-old', 'delta-com-au', { to: 'info@delta.com.au', subject: 's', domain: 'delta.com.au', siteDomain: 'delta.com.au' });
store.markSent('run-gone', 'foxtrot-com-au', { to: 'foxtrotshutters@gmail.com', subject: 's', domain: 'gmail.com', siteDomain: 'foxtrot.com.au' });
{
  const log = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
  log['run-gone:foxtrot-com-au'].sentAt = new Date(Date.now() - 20 * DAY).toISOString();
  fs.writeFileSync(SENT_FILE, JSON.stringify(log));
}
fs.writeFileSync(path.join(DATA, 'prospects-suppression.json'), JSON.stringify(['bravo.com.au']));
store.setSkipped('run-new', 'charlie-com-au');

const closing = () => `\n\n${config.prospectsGuaranteeLine}\n\n${config.prospectsSignature}`;

// ---- guarantee line ----

test('the guarantee has the agreed default text', () => {
  assert.equal(config.prospectsGuaranteeLine,
    'Our promise: we fix every issue in the audit, then re-test until your mobile speed score is 70+ and Google and AI search tools can read your business details correctly. Until both pass, we keep working at no extra cost.');
});

test('PROSPECTS_GUARANTEE_LINE set to an empty string turns it off', () => {
  const configPath = require.resolve('../lib/config');
  const saved = require.cache[configPath];
  process.env.PROSPECTS_GUARANTEE_LINE = '';
  delete require.cache[configPath];
  try {
    assert.equal(require('../lib/config').prospectsGuaranteeLine, '');
  } finally {
    delete process.env.PROSPECTS_GUARANTEE_LINE;
    require.cache[configPath] = saved;
  }
});

test('the guarantee goes after the AI body and before the signature', async () => {
  const d = await store.buildDraft('run-new', 'acme-com-au');
  assert.equal(d.status, 'pending');
  assert.equal(d.body, AI_BODY + closing());
  const saved = store.getSavedDraft('run-new', 'acme-com-au');
  assert.equal(saved.body, AI_BODY, 'stored without guarantee or signature');
});

test('the word cap does not count the guarantee', async () => {
  const original = config.prospectsMaxWords;
  config.prospectsMaxWords = AI_BODY.split(/\s+/).length; // exactly the AI body
  try {
    const d = await store.buildDraft('run-new', 'acme-com-au');
    assert.equal(d.saved, true);
    assert.equal(d.status, 'pending');
    assert.ok(d.body.includes(config.prospectsGuaranteeLine));
  } finally {
    config.prospectsMaxWords = original;
  }
});

test('an empty guarantee is left out, and the signature follows the body directly', async () => {
  const original = config.prospectsGuaranteeLine;
  config.prospectsGuaranteeLine = '';
  try {
    const d = await store.buildDraft('run-new', 'acme-com-au');
    assert.equal(d.body, `${AI_BODY}\n\n${config.prospectsSignature}`);
  } finally {
    config.prospectsGuaranteeLine = original;
  }
});

test('the follow-up carries the guarantee just before the signature', () => {
  const log = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
  log['run-old:delta-com-au'].sentAt = new Date(Date.now() - 10 * DAY).toISOString();
  fs.writeFileSync(SENT_FILE, JSON.stringify(log));
  const fu = store.buildFollowUp('run-old', 'delta-com-au');
  assert.equal(fu.state, 'due');
  assert.ok(fu.body.endsWith(closing()));
  // Put Delta back inside the cooldown for the queue tests below.
  log['run-old:delta-com-au'].sentAt = new Date().toISOString();
  fs.writeFileSync(SENT_FILE, JSON.stringify(log));
});

// ---- pre-drafting ----

test('predraft writes drafts only for emailable prospects without one, one model call each', async () => {
  modelCalls.length = 0;
  assert.deepEqual(store.predraftCandidates().map((c) => c.slug).sort(), ['golf-com-au', 'hotel-com-au']);
  const summary = await store.predraftAll({ retryWaitMs: 0 });
  assert.equal(summary.started, true);
  assert.equal(summary.candidates, 2);
  assert.deepEqual(modelCalls.sort(), ['Golf Blinds', 'Hotel Blinds'], 'no call for Acme (drafted), Delta (sent), Bravo, Charlie, Foxtrot, Echo');
  assert.equal(summary.drafted, 1);
  assert.equal(summary.flagged, 1, 'Golf is over the word cap');
  assert.ok(store.getSavedDraft('run-new', 'hotel-com-au'));

  const again = await store.predraftAll({ retryWaitMs: 0 });
  assert.equal(again.candidates, 0);
  assert.equal(modelCalls.length, 2, 'a second run drafts nothing');
  assert.equal(store.predraftStatus().running, false);
});

test('predraft skips a prospect still being site-checked, retries it after the rest, and reports it', async () => {
  makeRun('run-later', [p('india-com-au', 'India Blinds', 'info@india.com.au'), p('juliet-com-au', 'Juliet Blinds', 'info@juliet.com.au')], 0);
  let indiaAsks = 0;
  store.setSiteCheck({
    get: async (host) => {
      if (host === 'india.com.au' && (indiaAsks += 1) < 3) return { state: 'pending' };
      if (host === 'juliet.com.au') return { state: 'pending' };
      return { state: 'unavailable', reason: 'test' };
    },
  });
  try {
    const summary = await store.predraftAll({ retryWaitMs: 0, checkRounds: 3 });
    const by = Object.fromEntries(summary.results.map((r) => [r.slug, r.status]));
    assert.equal(by['india-com-au'], 'pending', 'drafted once its check finished');
    assert.equal(by['juliet-com-au'], 'checking');
    assert.equal(summary.checking, 1);
    assert.equal(store.getSavedDraft('run-later', 'juliet-com-au'), null);
  } finally {
    store.setSiteCheck(null);
    fs.rmSync(path.join(process.env.PROSPECTS_REPORTS_DIR, 'run-later'), { recursive: true });
  }
});

test('only one predraft runs at a time', async () => {
  let release;
  store.setSiteCheck({ get: () => new Promise((r) => { release = () => r({ state: 'unavailable', reason: 'test' }); }) });
  makeRun('run-later', [p('kilo-com-au', 'Kilo Blinds', 'info@kilo.com.au')], 0);
  try {
    const first = store.predraftAll({ retryWaitMs: 0 });
    assert.equal(store.predraftStatus().running, true);
    const second = await store.predraftAll({ retryWaitMs: 0 });
    assert.equal(second.started, false);
    while (!release) await new Promise((r) => setImmediate(r));
    release();
    assert.equal((await first).drafted, 1);
    assert.equal(store.predraftStatus().running, false);
  } finally {
    store.setSiteCheck(null);
    fs.rmSync(path.join(process.env.PROSPECTS_REPORTS_DIR, 'run-later'), { recursive: true });
  }
});

// ---- the queue ----

test('the queue lists only emailable drafted prospects, one per business, latest run first', () => {
  const q = store.buildQueue();
  const slugs = q.items.map((i) => `${i.run}:${i.slug}`);
  assert.deepEqual(slugs, ['run-new:acme-com-au', 'run-new:hotel-com-au', 'run-new:golf-com-au'], 'ready first, flagged last');
  const acme = q.items[0];
  assert.equal(acme.label, 'Acme Shutters', 'the latest run wins');
  assert.equal(acme.to, 'info@acme.com.au');
  assert.equal(acme.domain, 'acme.com.au');
  assert.equal(acme.body, AI_BODY + closing(), 'exactly what the draft route returns');
  assert.equal(acme.flagged, false);
  assert.equal(acme.leadsWith.source, 'audit');
  const golf = q.items[2];
  assert.equal(golf.status, 'auto_rejected');
  assert.equal(golf.flagged, true);
  assert.match(golf.reason, /words \(max/);
  assert.equal(q.counts.ready, 2);
  assert.equal(q.counts.flagged, 1);
  assert.equal(q.counts.suppressed, 1); // Bravo
  assert.equal(q.counts.skipped, 1); // Charlie
  assert.equal(q.counts.cooldown, 1); // Foxtrot, sent from another batch to a Gmail address
  assert.equal(q.counts.sent, 1); // Delta
  assert.equal(q.counts.noEmail, 1); // Echo
  assert.equal(q.counts.missingDraft, 0);
  assert.deepEqual(q.weekly, { sentLast7Days: 1, limit: config.prospectsRateLimitPerWeek, remaining: config.prospectsRateLimitPerWeek - 1 });
});

test('a prospect without a draft is counted, not listed', () => {
  makeRun('run-later', [p('lima-com-au', 'Lima Blinds', 'info@lima.com.au')], 0);
  try {
    const q = store.buildQueue();
    assert.equal(q.counts.missingDraft, 1);
    assert.ok(!q.items.some((i) => i.slug === 'lima-com-au'));
  } finally {
    fs.rmSync(path.join(process.env.PROSPECTS_REPORTS_DIR, 'run-later'), { recursive: true });
  }
});

// ---- routes ----

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
const call = (base, method, p, body, headers = cookie) => fetch(base + p, {
  method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});

test('queue, skip and predraft routes are admin-only', async () => {
  const s = await serve();
  try {
    assert.equal((await call(s.base, 'GET', '/queue', undefined, {})).status, 401);
    assert.equal((await call(s.base, 'POST', '/hotel-com-au/skip?run=run-new', {}, {})).status, 401);
    assert.equal((await call(s.base, 'POST', '/predraft', {}, {})).status, 401);
  } finally {
    await s.close();
  }
});

test('skip takes a prospect out of the queue without suppressing it, and can be undone', async () => {
  const s = await serve();
  try {
    let r = await call(s.base, 'POST', '/hotel-com-au/skip?run=run-new', {});
    assert.equal(r.status, 200);
    assert.equal((await r.json()).skipped, true);
    let q = await (await call(s.base, 'GET', '/queue')).json();
    assert.ok(!q.items.some((i) => i.slug === 'hotel-com-au'));
    assert.equal(q.counts.skipped, 2);
    assert.equal(store.isSuppressed('hotel.com.au', 'info@hotel.com.au'), false);
    const stored = JSON.parse(fs.readFileSync(path.join(DATA, 'prospects-skipped.json'), 'utf8'));
    assert.equal(stored['run-new:hotel-com-au'].siteDomain, 'hotel.com.au');

    r = await call(s.base, 'POST', '/hotel-com-au/skip?run=run-new', { skipped: false });
    assert.equal((await r.json()).skipped, false);
    q = await (await call(s.base, 'GET', '/queue')).json();
    assert.ok(q.items.some((i) => i.slug === 'hotel-com-au'));

    assert.equal((await call(s.base, 'POST', '/nobody/skip?run=run-new', {})).status, 404);
    assert.equal((await call(s.base, 'POST', '/hotel-com-au/skip?run=../x', {})).status, 400);
  } finally {
    await s.close();
  }
});

test('a queue send to a business already emailed is refused before anything is sent', async () => {
  const s = await serve();
  try {
    const r = await call(s.base, 'POST', '/delta-com-au/send?run=run-old', {
      to: 'info@delta.com.au', subject: 'broken link on your page', body: 'Hello', fromQueue: true,
    });
    assert.equal(r.status, 409);
    assert.match((await r.json()).error, /already been emailed/);
    assert.equal(emailsSent.length, 0);
  } finally {
    await s.close();
  }
});

test('prospect emails reply to hello@telaloom.com, not the internal-alert address', async () => {
  makeRun('run-replyto', [p('replyto-com-au', 'Replyto Blinds', 'info@replyto.com.au')], 0);
  process.env.CONTACT_NOTIFICATION_EMAIL = 'hello@daintytrading.com';
  const s = await serve();
  try {
    const before = emailsSent.length;
    const r = await call(s.base, 'POST', '/replyto-com-au/send?run=run-replyto', {
      to: 'info@replyto.com.au', subject: 'broken link on your quote page', body: 'Hello',
    });
    assert.equal(r.status, 200);
    assert.equal(emailsSent.length, before + 1);
    assert.equal(emailsSent[emailsSent.length - 1].replyTo, 'hello@telaloom.com');
  } finally {
    delete process.env.CONTACT_NOTIFICATION_EMAIL;
    fs.rmSync(path.join(process.env.PROSPECTS_REPORTS_DIR, 'run-replyto'), { recursive: true });
    await s.close();
  }
});

test('POST /predraft starts in the background and refuses a second run', async () => {
  makeRun('run-later', [p('mike-com-au', 'Mike Blinds', 'info@mike.com.au')], 0);
  let release;
  store.setSiteCheck({ get: () => new Promise((r) => { release = () => r({ state: 'unavailable', reason: 'test' }); }) });
  const s = await serve();
  try {
    const r = await call(s.base, 'POST', '/predraft', {});
    assert.equal(r.status, 202);
    const started = await r.json();
    assert.equal(started.running, true);
    assert.equal(started.progress.total, 1);
    assert.equal((await call(s.base, 'POST', '/predraft', {})).status, 409);
    while (!release) await new Promise((res) => setImmediate(res));
    release();
    let status;
    for (let i = 0; i < 50; i += 1) {
      status = await (await call(s.base, 'GET', '/predraft')).json();
      if (!status.running) break;
      await new Promise((res) => setTimeout(res, 10));
    }
    assert.equal(status.running, false);
    assert.equal(status.last.drafted, 1);
    assert.ok(store.getSavedDraft('run-later', 'mike-com-au'));
  } finally {
    await s.close();
    store.setSiteCheck(null);
  }
});
