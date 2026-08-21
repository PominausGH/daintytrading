#!/usr/bin/env node
/**
 * Feeds each client's portal checklist from the site-audit rotation.
 *
 * Source: open findings in findings.json marked `"owner": "client"` — the
 * things only the business owner can do (Google Business Profile, reviews, an
 * expired licence, a host support ticket, a decision about their own pricing).
 *
 * Findings we own are never surfaced here. They are our backlog, and they
 * frequently describe live weaknesses on the client's site. An unlabelled
 * finding counts as ours, so the checklist stays empty rather than
 * over-disclosing while `owner` rolls out across existing findings files.
 *
 * Safe to run repeatedly: syncClientActions() carries the client's own ticks
 * forward, and an item the audit no longer reports becomes "verified" rather
 * than vanishing — so the list doubles as the record of what they got done.
 *
 * Usage: node scripts/sync-client-actions.js [--dry-run]
 */
const path = require('path');
const fs = require('fs');

process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const { getClient, syncClientActions } = require('../lib/clients-store');

const AUDITS_DIR = '/opt/docker/marketing-os/audits';
const DRY_RUN = process.argv.includes('--dry-run');

// Same mapping the update drafter uses. Keep the two in step.
const CLIENTS = [
  { token: 'geymo8cnyasc', name: 'Darren', auditDomain: 'www.eklawyers.com.au' },
  { token: 'gkrkdzenl94u', name: 'Craig', auditDomain: 'tradepriceshutters.com.au' },
];

function openClientOwnedFindings(auditDomain) {
  const file = path.join(AUDITS_DIR, auditDomain, 'findings.json');
  if (!fs.existsSync(file)) return null; // distinct from "audited, nothing outstanding"

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[${auditDomain}] findings.json unreadable: ${err.message}`);
    return null;
  }

  const findings = Array.isArray(parsed) ? parsed : parsed.findings || [];
  return findings
    .filter((f) => f.status === 'open' && f.owner === 'client')
    .map((f) => ({ id: f.id, text: f.title || f.id }))
    .filter((f) => f.id && f.text);
}

function main() {
  for (const client of CLIENTS) {
    if (!getClient(client.token)) {
      console.log(`[${client.name}] no portal record for token ${client.token}, skipping`);
      continue;
    }

    const items = openClientOwnedFindings(client.auditDomain);
    if (items === null) {
      // No audit data at all. Do NOT sync an empty list — that would mark
      // every existing item "verified" on the strength of a missing file.
      console.log(`[${client.name}] no readable findings for ${client.auditDomain}, leaving the checklist untouched`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`[${client.name}] would sync ${items.length} item(s) from ${client.auditDomain}`);
      items.forEach((i) => console.log(`    - ${i.id}: ${i.text.slice(0, 90)}`));
      continue;
    }

    const next = syncClientActions(client.token, items);
    const outstanding = next.filter((a) => !a.verifiedFixed && !a.claimedDone).length;
    const claimed = next.filter((a) => !a.verifiedFixed && a.claimedDone).length;
    const verified = next.filter((a) => a.verifiedFixed).length;
    console.log(
      `[${client.name}] ${outstanding} outstanding, ${claimed} awaiting confirmation, ${verified} confirmed done`
    );
  }
}

main();
