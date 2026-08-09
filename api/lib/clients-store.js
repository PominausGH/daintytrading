const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CLIENTS_DIR = path.join(DATA_DIR, 'clients');
const NOTES_FILE = path.join(DATA_DIR, 'status-notes.jsonl');

const TOKEN_RE = /^[a-z0-9-]{6,64}$/;

function clientPath(token) {
  return path.join(CLIENTS_DIR, `${token}.json`);
}

function getClient(token) {
  if (!token || typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const file = clientPath(token);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function createClient({ name, project, status, phase, nextMilestone, notes }) {
  fs.mkdirSync(CLIENTS_DIR, { recursive: true });
  const token = crypto.randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  const record = {
    token,
    clientName: name,
    project,
    status: status || 'Scoping',
    phase: phase || '',
    nextMilestone: nextMilestone || '',
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(clientPath(token), JSON.stringify(record, null, 2));
  return record;
}

function saveClientNote(token, { name, note, targetDate, author }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const record = {
    id: crypto.randomBytes(4).toString('hex'),
    token,
    name,
    note,
    targetDate: targetDate || null,
    author: author || 'client',
    submittedAt: new Date().toISOString(),
  };
  fs.appendFileSync(NOTES_FILE, JSON.stringify(record) + '\n');
  return record;
}

// Reads every note record, backfilling an id onto any older record that
// predates ids being added — self-healing so callers never see a note
// they can't address for edit/delete.
function readAllNotes() {
  if (!fs.existsSync(NOTES_FILE)) return [];
  const records = fs.readFileSync(NOTES_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);

  let backfilled = false;
  records.forEach((r) => {
    if (!r.id) {
      r.id = crypto.randomBytes(4).toString('hex');
      backfilled = true;
    }
  });
  if (backfilled) {
    fs.writeFileSync(NOTES_FILE, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }
  return records;
}

function listClientNotes(token) {
  return readAllNotes()
    .filter((r) => r.token === token)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

function updateClientNote(token, noteId, { note, targetDate }) {
  const records = readAllNotes();
  const record = records.find((r) => r.token === token && r.id === noteId);
  if (!record) return null;
  if (note != null) record.note = note;
  if (targetDate !== undefined) record.targetDate = targetDate || null;
  record.editedAt = new Date().toISOString();
  fs.writeFileSync(NOTES_FILE, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return record;
}

function deleteClientNote(token, noteId) {
  const records = readAllNotes();
  const remaining = records.filter((r) => !(r.token === token && r.id === noteId));
  if (remaining.length === records.length) return false;
  fs.writeFileSync(NOTES_FILE, remaining.length ? remaining.map((r) => JSON.stringify(r)).join('\n') + '\n' : '');
  return true;
}

module.exports = { getClient, createClient, saveClientNote, listClientNotes, updateClientNote, deleteClientNote, TOKEN_RE };
