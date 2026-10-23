import test from 'node:test';
import assert from 'node:assert';
import { buildPushes, diff, judge, priorityFor, serverClient, sitesFrom } from '../src/logic.js';

const syd = (iso) => new Date(iso + '+11:00'); // AEDT
const scale = { name: 'Scale Co', plan: 'scale', care: true, sites: [{ url: 'https://s.com/', expect: 'Scale' }] };
const care = { name: 'Care Co', plan: 'care', care: true, sites: ['https://c.com/'] };

test('priority rules match the API', () => {
  assert.strictEqual(priorityFor(scale, syd('2026-10-20T20:00:00')), 2);
  assert.strictEqual(priorityFor(scale, syd('2026-10-20T23:00:00')), 0);
  assert.strictEqual(priorityFor(care, syd('2026-10-20T10:00:00')), 1);
  assert.strictEqual(priorityFor(care, syd('2026-10-24T10:00:00')), 0);
});

test('server outage counts as Scale once any Scale client exists', () => {
  assert.strictEqual(serverClient([care]).plan, 'care');
  assert.strictEqual(serverClient([care, scale]).plan, 'scale');
});

test('sites and judging', () => {
  assert.deepStrictEqual(sitesFrom([scale, care, { name: 'x', care: false, sites: ['https://x/'] }]).map((s) => s.url), ['https://s.com/', 'https://c.com/']);
  assert.ok(judge({ status: 200 }, 'Scale Co', 'scale').up);
  assert.ok(!judge({ status: 200 }, 'hacked', 'Scale').up);
  assert.ok(!judge({ status: 502 }, '', null).up);
  assert.ok(judge({ status: 429 }, 'Too Many Requests', 'Scale').up, 'rate-limited is not down');
});

test('diff: alert once on down, once on recovery, grouped into one push', () => {
  const r = (url, up) => ({ url, name: url, client: care, up, detail: 'HTTP 502' });
  let s = diff({}, [r('a', false), r('b', false), r('c', true)], 0);
  assert.strictEqual(s.wentDown.length, 2);
  const pushes = buildPushes(s.wentDown, s.cameBack, syd('2026-10-20T10:00:00'));
  assert.strictEqual(pushes.length, 1);
  assert.match(pushes[0].title, /DOWN: 2 sites/);
  assert.strictEqual(pushes[0].priority, 1);
  s = diff(s.next, [r('a', false), r('b', false)], 60000);
  assert.strictEqual(s.wentDown.length, 0, 'no repeat while still down');
  s = diff(s.next, [r('a', true), r('b', false)], 5 * 60000);
  assert.strictEqual(s.cameBack.length, 1);
  assert.strictEqual(s.cameBack[0].mins, 5);
  assert.deepStrictEqual(Object.keys(s.next), ['b']);
});
