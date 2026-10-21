'use strict';
// Tracks the Cloudflare uptime-watch worker (cloudflare/uptime-watch/), which checks client sites
// from outside this server and POSTs /api/monitor/heartbeat every minute. While it's alive the
// local monitor skips its per-minute site checks (no double alerts). If it goes quiet, the local
// monitor takes over and pushes once to say so.
const STALE_MS = 3 * 60 * 1000; // local checks resume after 3 missed heartbeats
const ALERT_MS = 10 * 60 * 1000; // "outside monitor stopped" push after 10 min quiet

const bootedAt = Date.now();
let lastSeen = 0;

const markSeen = (now = Date.now()) => { lastSeen = now; };
const isActive = (now = Date.now()) => lastSeen > 0 && now - lastSeen < STALE_MS;
// Quiet long enough to tell someone. Counts from boot if the worker hasn't been seen yet.
const isMissing = (now = Date.now()) => now - (lastSeen || bootedAt) >= ALERT_MS;
const lastSeenAt = () => lastSeen;
const _reset = () => { lastSeen = 0; };

module.exports = { markSeen, isActive, isMissing, lastSeenAt, _reset, STALE_MS, ALERT_MS };
