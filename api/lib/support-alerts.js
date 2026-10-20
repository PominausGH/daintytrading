'use strict';
// Who may wake Andrew up, and when. Mirrors the published response times on /support.html:
//   - Care + Scale: urgent within 3 hours, 7am-10pm Sydney, 7 days  -> emergency push (priority 2)
//   - Care (any other plan): urgent same business day / 4 business hours -> high push (priority 1)
//     during business hours, normal push outside them
//   - anyone else (unknown sender, no Care): normal push, never wakes anyone
// Nothing is promised 10pm-7am, so nothing is an emergency then.
//
// Clients are listed in DATA_DIR/support-clients.json (not in git, see support-clients.example.json):
//   { "clients": [ { "name": "...", "plan": "care|monitor|growth|scale", "care": true,
//                    "emails": ["owner@client.com"], "domains": ["client.com"],
//                    "sites": [{ "url": "https://client.com/", "expect": "Client Pty Ltd" }] } ] }
const fs = require('fs');
const path = require('path');

const TZ = 'Australia/Sydney';

function clientsFile(env = process.env) {
  return path.join(env.DATA_DIR || path.join(__dirname, '..', 'data'), 'support-clients.json');
}

function loadClients(file = clientsFile()) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed.clients) ? parsed.clients : [];
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[support-alerts] could not read', file, err.message);
    return [];
  }
}

function sydneyClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { hour: parseInt(parts.hour, 10), weekday: parts.weekday };
}

const inWakeHours = (now) => {
  const { hour } = sydneyClock(now);
  return hour >= 7 && hour < 22;
};

// NSW public holidays aren't modelled: a holiday just gets a high push instead of a normal one.
const inBusinessHours = (now) => {
  const { hour, weekday } = sydneyClock(now);
  return !['Sat', 'Sun'].includes(weekday) && hour >= 9 && hour < 17;
};

function priorityFor(client, now = new Date()) {
  if (!client || !client.care) return 0;
  if (String(client.plan).toLowerCase() === 'scale' && inWakeHours(now)) return 2;
  if (inBusinessHours(now)) return 1;
  return 0;
}

function findClientBySender(address, clients) {
  const email = String(address || '').trim().toLowerCase();
  const domain = email.split('@')[1] || '';
  if (!domain) return null;
  return (
    clients.find((c) => (c.emails || []).some((e) => String(e).toLowerCase() === email)) ||
    clients.find((c) => (c.domains || []).some((d) => String(d).toLowerCase() === domain)) ||
    null
  );
}

// A site is a URL string, or { url, expect } where expect is text that must appear on the page
// (the business name, say). A hacked, defaced or blank page often still returns HTTP 200.
function monitoredSites(clients) {
  return clients.flatMap((c) =>
    (c.sites || []).map((site) =>
      typeof site === 'string' ? { url: site, expect: null, client: c } : { url: site.url, expect: site.expect || null, client: c }
    )
  ).filter((s) => s.url);
}

module.exports = { loadClients, clientsFile, priorityFor, findClientBySender, monitoredSites, inWakeHours, inBusinessHours, sydneyClock };
