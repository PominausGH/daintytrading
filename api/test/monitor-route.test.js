'use strict';
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { buildRouter } = require('../routes/monitor');
const outside = require('../lib/outside-monitor');
const { createMonitor } = require('../lib/uptime-monitor');

const clients = [
  { name: 'Care Co', plan: 'scale', care: true, emails: ['boss@care.com'], sites: ['https://care.com/'] },
  { name: 'SEO Co', plan: 'growth', care: false, sites: ['https://seo.com/'] },
];

async function withServer(router, fn) {
  const app = express();
  app.use(express.json());
  app.use('/api/monitor', router);
  const srv = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${srv.address().port}/api/monitor`);
  } finally {
    srv.close();
  }
}

test('monitor routes: secret required, Care sites only, no emails, heartbeat marks seen', async () => {
  outside._reset();
  await withServer(buildRouter({ secret: 's3cret', loadClients: () => clients }), async (base) => {
    assert.strictEqual((await fetch(`${base}/sites`)).status, 401);
    assert.strictEqual((await fetch(`${base}/sites`, { headers: { Authorization: 'Bearer nope' } })).status, 401);
    const res = await fetch(`${base}/sites`, { headers: { Authorization: 'Bearer s3cret' } });
    const body = await res.json();
    assert.deepStrictEqual(body.clients.map((c) => c.name), ['Care Co']);
    assert.ok(!('emails' in body.clients[0]));
    assert.ok(!outside.isActive());
    assert.strictEqual((await fetch(`${base}/heartbeat`, { method: 'POST', headers: { Authorization: 'Bearer s3cret' } })).status, 200);
    assert.ok(outside.isActive());
  });
  await withServer(buildRouter({ secret: '' }), async (base) => {
    assert.strictEqual((await fetch(`${base}/sites`)).status, 503);
  });
});

test('local monitor stands down while the worker is alive, and says so when it vanishes', async () => {
  let fetched = 0;
  const sent = [];
  let t = Date.parse('2026-10-20T00:00:00Z');
  const fake = { active: true, missing: false, isActive() { return this.active; }, isMissing() { return this.missing; } };
  const m = createMonitor({
    monitorSecret: 'x',
    outside: fake,
    fetchImpl: async () => { fetched++; return { status: 200, text: async () => '' }; },
    sendPush: async (p) => { sent.push(p); return { ok: true }; },
    loadClients: () => clients,
    now: () => new Date(t),
  });
  await m.tick();
  assert.strictEqual(fetched, 0, 'worker alive: no local checks');
  fake.active = false; fake.missing = true;
  await m.tick();
  await m.tick();
  assert.strictEqual(fetched, 2, 'worker gone: local checks resume');
  assert.deepStrictEqual(sent.map((p) => p.title), ['Outside monitor stopped']);
  fake.active = true; fake.missing = false;
  await m.tick();
  assert.deepStrictEqual(sent.map((p) => p.title), ['Outside monitor stopped', 'Outside monitor back']);
});
