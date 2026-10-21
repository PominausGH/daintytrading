'use strict';
// Monitoring for client sites on the Care plan (sites listed in support-clients.json).
// Every minute: the page answers with HTTP < 400 and, if the site has `expect` text, that text is on
// the page (catches defaced, hacked or blank pages that still return 200). A site is "down" after
// 3 failed checks in a row, which filters one-off blips; down and recovery each push once.
// Daily: SSL certificate under 14 days from expiry, domain registration under 30 days (RDAP;
// some registries, including .au, don't publish an expiry date, so those are skipped).
const tls = require('tls');
const { sendPush } = require('./pushover');
const support = require('./support-alerts');
const outside = require('./outside-monitor');

const INTERVAL_MS = 60 * 1000;
const FAILS_TO_ALERT = 3;
const TIMEOUT_MS = 15000;
const UA = 'TelaLoom-Uptime/1.0 (+https://telaloom.com/support.html)';
const CERT_CHECK_MS = 24 * 60 * 60 * 1000;
const CERT_WARN_DAYS = 14;

async function checkOnce(url, fetchImpl = fetch, expect = null) {
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text().catch(() => ''); // also releases the socket
    if (res.status >= 400) return { up: false, detail: `HTTP ${res.status}` };
    if (expect && !body.toLowerCase().includes(String(expect).toLowerCase())) {
      return { up: false, detail: `page loads (HTTP ${res.status}) but "${expect}" is missing, possible defacement or broken page` };
    }
    return { up: true, status: res.status };
  } catch (err) {
    return { up: false, detail: err.name === 'TimeoutError' ? `no response in ${TIMEOUT_MS / 1000}s` : err.message };
  }
}

function certDaysLeft(url) {
  return new Promise((resolve) => {
    let host;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return resolve(null);
      host = u.hostname;
    } catch {
      return resolve(null);
    }
    const sock = tls.connect({ host, port: 443, servername: host, timeout: TIMEOUT_MS }, () => {
      const cert = sock.getPeerCertificate();
      sock.end();
      resolve(cert && cert.valid_to ? Math.floor((new Date(cert.valid_to) - Date.now()) / 86400000) : null);
    });
    sock.on('error', () => resolve(null));
    sock.on('timeout', () => { sock.destroy(); resolve(null); });
  });
}

const DOMAIN_WARN_DAYS = 30;

// Registered domain, roughly: last two labels, or three for two-level suffixes like com.au.
function registeredDomain(url) {
  try {
    const labels = new URL(url).hostname.replace(/^www\./, '').split('.');
    const twoLevel = /^(com|net|org|edu|gov|asn|id|co)$/.test(labels[labels.length - 2] || '') && labels[labels.length - 1].length === 2;
    return labels.slice(twoLevel ? -3 : -2).join('.');
  } catch {
    return null;
  }
}

async function domainDaysLeft(url, fetchImpl = fetch) {
  const domain = registeredDomain(url);
  if (!domain) return null;
  try {
    const res = await fetchImpl(`https://rdap.org/domain/${domain}`, {
      // rdap.org returns 403 to requests without a user agent.
      headers: { 'user-agent': UA, accept: 'application/rdap+json, application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const exp = (data.events || []).find((e) => e.eventAction === 'expiration');
    return exp ? Math.floor((new Date(exp.eventDate) - Date.now()) / 86400000) : null;
  } catch {
    return null;
  }
}

const fmtMins = (ms) => `${Math.max(1, Math.round(ms / 60000))} min`;

function createMonitor(deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const push = deps.sendPush || sendPush;
  const loadClients = deps.loadClients || (() => support.loadClients());
  const clock = deps.now || (() => new Date());
  const state = new Map(); // url -> { fails, down, downSince, lastDetail }

  const outsideMon = deps.outside || outside;
  const watchdog = { alerted: false };

  // The Cloudflare worker does the per-minute checks while it's alive; this server takes over
  // when it isn't. MONITOR_SECRET unset = no worker expected, always check locally.
  async function watchOutside(now) {
    if (!(deps.monitorSecret !== undefined ? deps.monitorSecret : process.env.MONITOR_SECRET)) return false;
    const active = outsideMon.isActive(now.getTime());
    if (outsideMon.isMissing(now.getTime()) && !watchdog.alerted) {
      watchdog.alerted = true;
      await push({
        title: 'Outside monitor stopped',
        message: 'The Cloudflare uptime-watch worker has not checked in for 10+ minutes. This server is checking the sites itself until it returns. See cloudflare/uptime-watch in the dainty repo.',
        priority: 0,
      });
    } else if (active && watchdog.alerted) {
      watchdog.alerted = false;
      await push({ title: 'Outside monitor back', message: 'The uptime-watch worker is checking in again.', priority: 0 });
    }
    return active;
  }

  async function tick() {
    if (await watchOutside(clock())) {
      state.clear(); // the worker owns down/up state while it's running
      return;
    }
    const sites = support.monitoredSites(loadClients()).filter((s) => s.client.care);
    await Promise.all(sites.map(async ({ url, expect, client }) => {
      const s = state.get(url) || { fails: 0, down: false, downSince: null, lastDetail: '' };
      state.set(url, s);
      const r = await checkOnce(url, fetchImpl, expect);
      const now = clock();
      if (r.up) {
        if (s.down) {
          await push({
            title: `Back up: ${client.name}`,
            message: `${url} is responding again (HTTP ${r.status}) after ${fmtMins(now - s.downSince)}.`,
            priority: 0,
            url,
          });
        }
        Object.assign(s, { fails: 0, down: false, downSince: null, lastDetail: '' });
        return;
      }
      s.fails += 1;
      s.lastDetail = r.detail;
      if (s.fails === 1) s.downSince = now;
      if (!s.down && s.fails >= FAILS_TO_ALERT) {
        s.down = true;
        await push({
          title: `DOWN: ${client.name}`,
          message: `${url} failed ${s.fails} checks in a row: ${r.detail}. Care${client.plan ? ` + ${client.plan}` : ''}.`,
          priority: support.priorityFor(client, now),
          url,
        });
      }
    }));
  }

  async function certTick() {
    const sites = support.monitoredSites(loadClients()).filter((s) => s.client.care);
    for (const { url, client } of sites) {
      const days = await (deps.certDaysLeft || certDaysLeft)(url);
      if (days !== null && days < CERT_WARN_DAYS) {
        await push({ title: `SSL expiring: ${client.name}`, message: `${url} certificate expires in ${days} days.`, priority: 0, url });
      }
      const domainDays = await (deps.domainDaysLeft || ((u) => domainDaysLeft(u, fetchImpl)))(url);
      if (domainDays !== null && domainDays < DOMAIN_WARN_DAYS) {
        await push({ title: `Domain expiring: ${client.name}`, message: `${registeredDomain(url)} registration expires in ${domainDays} days. Renewal is the client's; remind them.`, priority: 0, url });
      }
    }
  }

  return { tick, certTick, state };
}

function startUptimeMonitor() {
  const monitor = createMonitor();
  const run = (fn, name) => fn().catch((err) => console.error(`[uptime-monitor] ${name} failed:`, err.message));
  const count = support.monitoredSites(support.loadClients()).length;
  console.log(`[uptime-monitor] watching ${count} site(s) every ${INTERVAL_MS / 1000}s`);
  setInterval(() => run(monitor.tick, 'tick'), INTERVAL_MS).unref();
  setInterval(() => run(monitor.certTick, 'cert check'), CERT_CHECK_MS).unref();
  setTimeout(() => run(monitor.certTick, 'cert check'), 30000).unref();
  return monitor;
}

module.exports = { createMonitor, startUptimeMonitor, checkOnce, registeredDomain, domainDaysLeft, FAILS_TO_ALERT };
