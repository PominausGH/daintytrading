#!/usr/bin/env node
/**
 * CLI to create/update a client status record, no admin UI needed.
 *
 * Create a new client:
 *   node scripts/client-status.js new "Craig" "Trade Price Shutters"
 *
 * Update an existing one by token:
 *   node scripts/client-status.js update <token> --status "In progress" --phase "Building the quote calculator" --next "Demo Friday"
 *   node scripts/client-status.js update <token> --notify-email "someone@example.com"  (extra recipient for note notifications)
 *
 * Read one:
 *   node scripts/client-status.js show <token>
 */
const path = require('path');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const { getClient, createClient } = require('../lib/clients-store');
const fs = require('fs');

const [, , cmd, ...rest] = process.argv;

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    flags[key] = args[i + 1];
  }
  return flags;
}

if (cmd === 'new') {
  const [name, project] = rest;
  if (!name || !project) {
    console.error('Usage: node scripts/client-status.js new "<Client name>" "<Project name>"');
    process.exit(1);
  }
  const record = createClient({ name, project });
  console.log('Created client status record:');
  console.log(record);
  console.log('\nShareable link:');
  console.log(`https://daintytrading.com/status.html?token=${record.token}`);
} else if (cmd === 'update') {
  const [token, ...flagArgs] = rest;
  const client = getClient(token);
  if (!client) {
    console.error(`No client found for token "${token}"`);
    process.exit(1);
  }
  const flags = parseFlags(flagArgs);
  if (flags.status) client.status = flags.status;
  if (flags.phase) client.phase = flags.phase;
  if (flags.next) client.nextMilestone = flags.next;
  if (flags.notes) client.notes = flags.notes;
  if (flags['notify-email']) client.notifyEmail = flags['notify-email'];
  client.updatedAt = new Date().toISOString();
  const file = path.join(process.env.DATA_DIR, 'clients', `${token}.json`);
  fs.writeFileSync(file, JSON.stringify(client, null, 2));
  console.log('Updated:');
  console.log(client);
} else if (cmd === 'show') {
  const [token] = rest;
  const client = getClient(token);
  if (!client) {
    console.error(`No client found for token "${token}"`);
    process.exit(1);
  }
  console.log(client);
} else {
  console.log('Usage:');
  console.log('  node scripts/client-status.js new "<Client name>" "<Project name>"');
  console.log('  node scripts/client-status.js update <token> --status "..." --phase "..." --next "..." --notes "..." --notify-email "..."');
  console.log('  node scripts/client-status.js show <token>');
}
