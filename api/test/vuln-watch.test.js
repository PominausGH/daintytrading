'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runWatch, watchTargets } = require('../lib/vuln-watch');

const CLIENTS = [
  { name: 'Monitor Co', plan: 'monitor', care: false, domains: ['monitor.example'], sites: [{ url: 'https://www.monitor.example/' }] },
  { name: 'Care Only', plan: 'care', care: true, sites: [{ url: 'https://care.example/' }] },
  { name: 'Scale <b>Co</b>', plan: 'Scale', sites: [{ url: 'https://scale.example/' }, 'https://scale.example/about'] },
  { name: 'No Sites', plan: 'growth' },
];

const finding = (id) => ({ id, title: `title ${id}`, evidence: 'PHP2Shell: PHP below the patched release' });
const okFetch = (byDomain) => async (_url, opts) => {
  const { domain } = JSON.parse(opts.body);
  const fn = byDomain[domain];
  if (fn instanceof Error) throw fn;
  return { ok: true, status: 200, json: async () => ({ outcome: 'x', findings: fn || [] }) };
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vw-'));

test('targets: care/monitor/growth/scale plans with a domain; hosts deduped; sites accept strings', () => {
  const t = watchTargets(CLIENTS);
  assert.deepEqual(t.map((x) => x.client), ['Monitor Co', 'Care Only', 'Scale <b>Co</b>']);
  assert.deepEqual(t[0].domains.sort(), ['monitor.example', 'www.monitor.example']);
  assert.deepEqual(t[1].domains, ['care.example']);
  assert.deepEqual(t[2].domains, ['scale.example']);
  assert.equal(watchTargets([{ name: 'Nope', plan: 'none', sites: [{ url: 'https://x.example/' }] }]).length, 0);
});

test('keeps only vulnerable-software findings and emails one summary', async () => {
  const sent = [];
  const dataDir = tmp();
  const r = await runWatch({
    clients: CLIENTS, dataDir, delayMs: 0, notifyEmail: 'ops@example.test',
    sendEmail: async (m) => sent.push(m),
    fetchImpl: okFetch({
      'monitor.example': [finding('known_vuln'), finding('security_headers')],
      'www.monitor.example': [],
      'scale.example': [finding('eol_software')],
    }),
    now: new Date('2026-12-01T00:00:00Z'),
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ops@example.test');
  assert.match(sent[0].subject, /Patch Watch 2026-12: 2 site\(s\) need attention/);
  assert.ok(!sent[0].html.includes('security_headers') && !sent[0].html.includes('title security_headers'));
  assert.ok(!sent[0].html.includes('<b>Co</b>'), 'client names are HTML-escaped');
  assert.match(sent[0].html, /Nothing has been sent to clients/);
  const rec = JSON.parse(fs.readFileSync(path.join(dataDir, 'vuln-watch', '2026-12.json'), 'utf8'));
  assert.equal(rec.results.length, 4);
  assert.equal(r.sent, true);
});

test('all clear still sends a summary (silence must never mean the job is broken)', async () => {
  const sent = [];
  await runWatch({ clients: CLIENTS, dataDir: tmp(), delayMs: 0, sendEmail: async (m) => sent.push(m), fetchImpl: okFetch({}) });
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /all clear$/);
});

test('a failed check is reported, does not abort the run, and is not called clear', async () => {
  const sent = [];
  await runWatch({
    clients: CLIENTS, dataDir: tmp(), delayMs: 0, sendEmail: async (m) => sent.push(m),
    fetchImpl: okFetch({ 'monitor.example': new Error('boom'), 'www.monitor.example': [], 'scale.example': [] }),
  });
  assert.match(sent[0].subject, /all clear, 1 check\(s\) failed/);
  assert.match(sent[0].html, /check failed: boom/);
});

test('dry run sends nothing and writes nothing', async () => {
  const dataDir = tmp();
  const sent = [];
  const logs = [];
  const r = await runWatch({
    clients: CLIENTS, dataDir, delayMs: 0, dryRun: true, sendEmail: async (m) => sent.push(m), fetchImpl: okFetch({}),
    log: { log: (m) => logs.push(m) },
  });
  assert.equal(sent.length, 0);
  assert.equal(r.sent, false);
  assert.equal(fs.existsSync(path.join(dataDir, 'vuln-watch')), false);
  assert.ok(logs.length > 0);
});

test('--domain filter checks just that domain', async () => {
  const seen = [];
  await runWatch({
    clients: CLIENTS, dataDir: tmp(), delayMs: 0, dryRun: true, only: 'scale.example', log: { log() {} },
    fetchImpl: async (_u, o) => { seen.push(JSON.parse(o.body).domain); return { ok: true, status: 200, json: async () => ({ findings: [] }) }; },
  });
  assert.deepEqual(seen, ['scale.example']);
});
