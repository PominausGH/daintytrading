'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { buildRouter } = require('../routes/site-check');
const { ServiceError } = require('../lib/sitecheck');
const { clientIp } = require('../lib/client-ip');

function serve(service) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/site-check', buildRouter(service));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve({
      base: `http://127.0.0.1:${server.address().port}/api/site-check`,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

const post = (base, p, body, headers = {}) => fetch(base + p, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('clientIp prefers a valid CF-Connecting-IP and ignores junk', () => {
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': '203.0.113.9' }, ip: '172.18.0.2' }), '203.0.113.9');
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': '2001:db8::1' }, ip: '172.18.0.2' }), '2001:db8::1');
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': 'not-an-ip' }, ip: '172.18.0.2' }), '172.18.0.2');
  assert.equal(clientIp({ headers: { 'cf-connecting-ip': '1.2.3.4, 5.6.7.8' }, ip: '172.18.0.2' }), '172.18.0.2');
  assert.equal(clientIp({ headers: {}, ip: '172.18.0.2' }), '172.18.0.2');
});

test('start forwards fields (incl. honeypot + timing) and the real client IP', async () => {
  const seen = [];
  const s = await serve({ start: async (a) => { seen.push(a); return { sessionId: 'abc' }; } });
  const r = await post(s.base, '/start', {
    domain: 'acme.com', email: 'a@acme.com', optin: 'true', dt_website: 'x', dt_form_loaded_at: '123',
  }, { 'cf-connecting-ip': '198.51.100.7' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { sessionId: 'abc' });
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(seen[0], {
    domain: 'acme.com', email: 'a@acme.com', optin: true, ip: '198.51.100.7', honeypot: 'x', loadedAt: '123',
  });
  await s.close();
});

test('rate limits are per real visitor, not one shared bucket for everyone', async () => {
  const s = await serve({ start: async () => ({ ok: true }) });
  const codes = [];
  for (let i = 0; i < 7; i += 1) codes.push((await post(s.base, '/start', {}, { 'cf-connecting-ip': '198.51.100.1' })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 200, 429]);
  const other = await post(s.base, '/start', {}, { 'cf-connecting-ip': '198.51.100.2' });
  assert.equal(other.status, 200, 'a different visitor must not be blocked by the first one');
  const limited = await post(s.base, '/start', {}, { 'cf-connecting-ip': '198.51.100.1' });
  assert.equal((await limited.json()).code, 'rate_limited');
  await s.close();
});

test('ServiceErrors become JSON with their status, code and extras', async () => {
  const s = await serve({
    verify: async () => { throw new ServiceError('wrong_code', 400, "That code isn't right.", { attemptsLeft: 3 }); },
  });
  const r = await post(s.base, '/verify', { sessionId: 'x', code: '1' });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: "That code isn't right.", code: 'wrong_code', attemptsLeft: 3 });
  await s.close();
});

test('unexpected errors are a generic 500 without internals', async () => {
  const s = await serve({ resend: async () => { throw new Error('db password is hunter2'); } });
  const r = await post(s.base, '/resend', { sessionId: 'x' });
  assert.equal(r.status, 500);
  const text = await r.text();
  assert.ok(!text.includes('hunter2'));
  assert.equal(JSON.parse(text).code, 'internal');
  await s.close();
});

test('status passes the wait flag and the job id; health works', async () => {
  const calls = [];
  const s = await serve({
    status: async (id, opts) => { calls.push([id, opts]); return { status: 'running' }; },
    health: async () => ({ ok: true }),
  });
  await fetch(`${s.base}/status/abc123?wait=1`);
  await fetch(`${s.base}/status/abc123`);
  assert.deepEqual(calls, [['abc123', { wait: true }], ['abc123', { wait: false }]]);
  assert.deepEqual(await (await fetch(`${s.base}/health`)).json(), { ok: true });
  await s.close();
});

test('malformed JSON and non-object bodies do not crash the route', async () => {
  const s = await serve({ start: async () => ({ ok: true }) });
  const bad = await fetch(`${s.base}/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.ok(bad.status >= 400 && bad.status < 500);
  const arr = await post(s.base, '/start', [1, 2, 3], { 'cf-connecting-ip': '198.51.100.50' });
  assert.equal(arr.status, 200);
  await s.close();
});
