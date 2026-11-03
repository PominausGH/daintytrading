#!/usr/bin/env node
/**
 * Monthly known-vulnerability watch (Patch Watch). Must run INSIDE the api container: the checker
 * has no published port and is only reachable on the private sitecheck-net.
 *
 *   docker exec daintytrading-api node scripts/vuln-watch.js --dry-run     # prints, no email, no file
 *   docker exec daintytrading-api node scripts/vuln-watch.js --dry-run --domain=example.com
 *   docker exec daintytrading-api node scripts/vuln-watch.js               # real run: record + summary email
 *
 * Suggested cron (1st of the month, 10:00 Sydney is ~23:00 UTC the day before; pick a UTC time):
 *   0 0 1 * * docker exec daintytrading-api node scripts/vuln-watch.js >> /var/log/vuln-watch.log 2>&1
 */
const path = require('path');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const { loadClients } = require('../lib/support-alerts');
const { sendEmail } = require('../lib/email');
const { runWatch } = require('../lib/vuln-watch');

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--domain=')) || '').slice('--domain='.length) || null;

runWatch({ clients: loadClients(), sendEmail, dryRun: args.includes('--dry-run'), only })
  .then((r) => { console.log(`[vuln-watch] ${r.summary.subject} (${r.results.length} checked, ${r.sent ? 'emailed' : 'not sent'})`); })
  .catch((err) => { console.error('[vuln-watch] failed:', err && err.stack || err); process.exit(1); });
