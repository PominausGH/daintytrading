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
 * Leave a note on a client's timeline (shows up alongside their own notes):
 *   node scripts/client-status.js note <token> "Pushed the demo to Monday, waiting on your go-ahead" --date 2026-08-17
 *
 * List notes (shows the id you need for edit/delete):
 *   node scripts/client-status.js notes <token>
 *
 * Edit or delete a note by id (works on your notes or the client's — fixes typos, retracts spam):
 *   node scripts/client-status.js edit-note <token> <noteId> "Corrected text" [--date YYYY-MM-DD]
 *   node scripts/client-status.js delete-note <token> <noteId>
 *
 * Read one:
 *   node scripts/client-status.js show <token>
 */
const path = require('path');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const { getClient, createClient, saveClientNote, listClientNotes, updateClientNote, deleteClientNote } = require('../lib/clients-store');
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
} else if (cmd === 'note') {
  const [token, noteText, ...flagArgs] = rest;
  const client = getClient(token);
  if (!client) {
    console.error(`No client found for token "${token}"`);
    process.exit(1);
  }
  if (!noteText) {
    console.error('Usage: node scripts/client-status.js note <token> "Note text" [--date YYYY-MM-DD] [--name "Andrew"]');
    process.exit(1);
  }
  const flags = parseFlags(flagArgs);
  const record = saveClientNote(token, {
    name: flags.name || 'Dainty Trading',
    note: noteText,
    targetDate: flags.date || null,
    author: 'studio',
  });
  console.log('Note added:');
  console.log(record);
} else if (cmd === 'notes') {
  const [token] = rest;
  const client = getClient(token);
  if (!client) {
    console.error(`No client found for token "${token}"`);
    process.exit(1);
  }
  const notes = listClientNotes(token);
  if (!notes.length) {
    console.log('No notes yet.');
  } else {
    notes.forEach((n) => {
      console.log(`[${n.id}] (${n.author}) ${n.name} — ${n.submittedAt}${n.editedAt ? ` (edited ${n.editedAt})` : ''}`);
      console.log(`  ${n.note}`);
      if (n.targetDate) console.log(`  target: ${n.targetDate}`);
      console.log('');
    });
  }
} else if (cmd === 'edit-note') {
  const [token, noteId, newText, ...flagArgs] = rest;
  if (!token || !noteId || !newText) {
    console.error('Usage: node scripts/client-status.js edit-note <token> <noteId> "Corrected text" [--date YYYY-MM-DD]');
    process.exit(1);
  }
  const flags = parseFlags(flagArgs);
  const updated = updateClientNote(token, noteId, {
    note: newText,
    targetDate: flags.date !== undefined ? flags.date : undefined,
  });
  if (!updated) {
    console.error(`No note found with id "${noteId}" for token "${token}"`);
    process.exit(1);
  }
  console.log('Note updated:');
  console.log(updated);
} else if (cmd === 'delete-note') {
  const [token, noteId] = rest;
  if (!token || !noteId) {
    console.error('Usage: node scripts/client-status.js delete-note <token> <noteId>');
    process.exit(1);
  }
  const deleted = deleteClientNote(token, noteId);
  if (!deleted) {
    console.error(`No note found with id "${noteId}" for token "${token}"`);
    process.exit(1);
  }
  console.log(`Note ${noteId} deleted.`);
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
  console.log('  node scripts/client-status.js note <token> "Note text" [--date YYYY-MM-DD] [--name "Andrew"]');
  console.log('  node scripts/client-status.js notes <token>');
  console.log('  node scripts/client-status.js edit-note <token> <noteId> "Corrected text" [--date YYYY-MM-DD]');
  console.log('  node scripts/client-status.js delete-note <token> <noteId>');
  console.log('  node scripts/client-status.js show <token>');
}
