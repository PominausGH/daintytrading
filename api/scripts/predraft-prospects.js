#!/usr/bin/env node
/**
 * Writes the outreach draft for every prospect that can be emailed today and has none yet, so the
 * dashboard's "Ready to send" queue is full when someone opens it. For cron:
 *
 *   docker exec daintytrading-api node scripts/predraft-prospects.js
 *
 * Must run inside the api container: it needs AIOS (the drafting model) and the site checker on
 * the container's networks, and writes the same data/ files the dashboard reads. One model call
 * per prospect, one at a time. Never sends anything.
 *
 * Options: --retry-no-finding  also retry prospects whose last attempt found nothing worth an email.
 *
 * Prints a JSON summary and exits 0, including when another run (the dashboard's "Draft the
 * rest" button) already holds the lock ({"started": false, ...}).
 */
const { createService } = require('../lib/sitecheck');
const { createProspectSiteCheck } = require('../lib/prospects-sitecheck');
const store = require('../lib/prospects-store');

// The site check the dashboard uses (same checker, same 24h cache on disk). checkOnly never emails
// anyone; the sendEmail given here refuses, in case that ever changes.
const service = createService({
  sendEmail: async () => ({ success: false, error: 'predraft-prospects never sends email' }),
});
store.setSiteCheck(createProspectSiteCheck({ checkDomain: (host) => service.checkOnly(host) }));

store
  .predraftAll({ retryNoFinding: process.argv.includes('--retry-no-finding') })
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.log(JSON.stringify({ started: true, error: err.message }));
    process.exit(0);
  });
