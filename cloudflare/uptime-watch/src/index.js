// uptime-watch: checks TelaLoom Care sites and the TelaLoom server from Cloudflare every minute,
// so an outage of this VPS itself still reaches Andrew's phone (Pushover).
//
// Each minute the cron trigger asks one Durable Object to run:
//  1. POST the server heartbeat. A 200 means the server is up, and tells it the worker is
//     alive so it skips its own per-minute checks (see api/lib/outside-monitor.js).
//  2. GET the site list from the server. If that fails, use the last list it returned.
//  3. Check every site; a failure is retried twice, 20s apart, so "down" = 3 failures in 40s.
//  4. Push once for everything that went down and once for everything that came back.
// Down/up state lives in Durable Object storage, written only when something changes.
import { DurableObject } from 'cloudflare:workers';
import { buildPushes, diff, judge, serverClient, sitesFrom } from './logic.js';

const UA = 'TelaLoom-Uptime/1.0 (+https://telaloom.com/support.html)';
const TIMEOUT_MS = 15000;
const RETRY_GAP_MS = 20000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkOnce(url, expect, init = {}) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      ...init,
      headers: { 'user-agent': UA, ...(init.headers || {}) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = expect ? await res.text() : (await res.body?.cancel(), '');
    return judge(res, body, expect);
  } catch (err) {
    return { up: false, detail: err.name === 'TimeoutError' ? `no response in ${TIMEOUT_MS / 1000}s` : String(err.message || err) };
  }
}

async function checkWithRetries(fn) {
  let r = await fn();
  for (let i = 0; i < 2 && !r.up; i++) {
    await sleep(RETRY_GAP_MS);
    r = await fn();
  }
  return r;
}

async function sendPush(env, p) {
  const form = new URLSearchParams({
    token: env.PUSHOVER_APP_TOKEN,
    user: env.PUSHOVER_USER_KEY,
    title: p.title.slice(0, 250),
    message: p.message.slice(0, 1024),
    priority: String(p.priority),
  });
  if (p.priority === 2) { form.set('retry', '60'); form.set('expire', '10800'); }
  if (p.url) form.set('url', p.url);
  const res = await fetch('https://api.pushover.net/1/messages.json', { method: 'POST', body: form });
  if (!res.ok) console.log('uptime-watch: push failed', res.status, (await res.text()).slice(0, 200));
}

export class Watch extends DurableObject {
  async run() {
    const env = this.env;
    // Between the first deploy and `wrangler secret put`, don't report a false server outage.
    if (!env.MONITOR_SECRET || !env.PUSHOVER_APP_TOKEN || !env.PUSHOVER_USER_KEY) {
      return { skipped: 'secrets not set' };
    }
    const auth = { Authorization: `Bearer ${env.MONITOR_SECRET}` };
    const base = env.TELALOOM_API;

    // The list fetch also goes through the server, so fetch it first and cache it.
    let clients = await this.ctx.storage.get('clients');
    try {
      const res = await fetch(`${base}/api/monitor/sites`, { headers: { ...auth, 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) {
        const fresh = (await res.json()).clients || [];
        if (JSON.stringify(fresh) !== JSON.stringify(clients)) await this.ctx.storage.put('clients', fresh);
        clients = fresh;
      }
    } catch (err) {
      console.log('uptime-watch: site list fetch failed, using cached list', String(err));
    }
    clients = clients || [];

    const server = serverClient(clients);
    const checks = [
      { url: `${base}/api/monitor/heartbeat`, name: server.name, client: server,
        fn: () => checkOnce(`${base}/api/monitor/heartbeat`, null, { method: 'POST', headers: auth }) },
      ...sitesFrom(clients).map((s) => ({ url: s.url, name: s.client.name, client: s.client, fn: () => checkOnce(s.url, s.expect) })),
    ];
    const results = await Promise.all(checks.map(async (c) => ({ ...c, ...(await checkWithRetries(c.fn)) })));

    const prev = (await this.ctx.storage.get('state')) || {};
    const { next, wentDown, cameBack } = diff(prev, results, Date.now());
    if (wentDown.length || cameBack.length || Object.keys(prev).length !== Object.keys(next).length) {
      await this.ctx.storage.put('state', next);
    }
    for (const p of buildPushes(wentDown, cameBack, new Date())) await sendPush(env, p);
    return { checked: results.length, down: Object.keys(next).length, wentDown: wentDown.length, cameBack: cameBack.length };
  }

  async fetch() {
    return Response.json(await this.run());
  }
}

export default {
  async scheduled(_event, env, ctx) {
    const stub = env.WATCH.get(env.WATCH.idFromName('main'));
    ctx.waitUntil(stub.fetch('https://watch/run').then((r) => r.text()).then((t) => console.log('uptime-watch:', t)));
  },
};
