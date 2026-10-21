'use strict';
// For the Cloudflare uptime-watch worker only (bearer MONITOR_SECRET):
//   GET  /api/monitor/sites      the Care sites to check, from data/support-clients.json
//   POST /api/monitor/heartbeat  "I ran"; also tells the worker this server is up
const express = require('express');
const { secretMatches } = require('./inbound-reply');
const support = require('../lib/support-alerts');
const outside = require('../lib/outside-monitor');

function buildRouter({ secret = process.env.MONITOR_SECRET || '', loadClients = () => support.loadClients() } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!secret) return res.status(503).json({ error: 'not_configured' });
    if (!secretMatches(req.headers.authorization, secret)) return res.status(401).json({ error: 'unauthorized' });
    next();
  });
  // Only what the worker needs: no client emails.
  router.get('/sites', (_req, res) => {
    const clients = loadClients()
      .filter((c) => c.care)
      .map((c) => ({ name: c.name, plan: c.plan || 'care', care: true, sites: c.sites || [] }));
    res.json({ clients });
  });
  router.post('/heartbeat', (_req, res) => {
    outside.markSeen();
    res.json({ ok: true });
  });
  return router;
}

const isMonitorPath = (p) => /^\/api\/monitor(\/|$)/.test(p);

module.exports = { buildRouter, isMonitorPath };
