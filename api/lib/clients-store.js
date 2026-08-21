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

function listAllClients() {
  if (!fs.existsSync(CLIENTS_DIR)) return [];
  return fs.readdirSync(CLIENTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(CLIENTS_DIR, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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

function updateClient(token, fields) {
  const client = getClient(token);
  if (!client) return null;
  const editable = ['status', 'phase', 'nextMilestone', 'notes', 'notifyEmail', 'clientName', 'project'];
  editable.forEach((key) => {
    if (fields[key] !== undefined) client[key] = fields[key];
  });
  client.updatedAt = new Date().toISOString();
  fs.writeFileSync(clientPath(token), JSON.stringify(client, null, 2));
  return client;
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

/**
 * Client action checklist — the things only the client can do.
 *
 * Every action has THREE states, not two, because a tick is a claim and not
 * proof:
 *
 *   open      claimedDone=false, verifiedFixed=false  — outstanding
 *   claimed   claimedDone=true,  verifiedFixed=false  — they say it's done,
 *                                                       the audit hasn't seen
 *                                                       it yet
 *   verified  verifiedFixed=true                      — the next site audit
 *                                                       independently confirmed
 *
 * The distinction is not pedantry. Google Business Profile edits take days to
 * propagate, and a client can genuinely believe they've done something they
 * haven't (or did it in the wrong place). Collapsing claim and proof into one
 * checkbox would silently close real findings, which is the failure this whole
 * pipeline exists to avoid. The site audit stays the source of truth; the
 * checkbox only records what the client told us and when.
 */
const ACTION_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

function toggleClientAction(token, actionId, done, by) {
  if (!ACTION_ID_RE.test(String(actionId || ''))) return null;
  const client = getClient(token);
  if (!client || !Array.isArray(client.actions)) return null;

  const action = client.actions.find((a) => a.id === actionId);
  if (!action) return null;

  // A verified item is settled by evidence; don't let a click reopen it.
  if (action.verifiedFixed) return action;

  action.claimedDone = !!done;
  action.claimedAt = done ? new Date().toISOString() : null;
  action.claimedBy = done ? String(by || '').slice(0, 80) || null : null;

  client.updatedAt = new Date().toISOString();
  fs.writeFileSync(clientPath(token), JSON.stringify(client, null, 2));
  return action;
}

/**
 * Reconcile a client's checklist against the audit.
 *
 * `openItems` is [{id, text}] — the currently-open, client-owned findings.
 * That list decides WHAT is required. This function never invents or removes
 * a requirement on its own; it only carries the client's own ticks forward.
 *
 * An action that has dropped out of openItems is one the audit no longer
 * sees, so it becomes verified rather than being deleted — the checklist
 * doubles as the record of what they actually got done.
 */
function syncClientActions(token, openItems) {
  const client = getClient(token);
  if (!client) return null;

  const existing = Array.isArray(client.actions) ? client.actions : [];
  const byId = new Map(existing.map((a) => [a.id, a]));
  const openIds = new Set(openItems.map((i) => i.id));
  const now = new Date().toISOString();

  const next = openItems
    .filter((i) => ACTION_ID_RE.test(String(i.id || '')))
    .map((i) => {
      const prev = byId.get(i.id);
      return {
        id: i.id,
        text: i.text,
        // Preserve the client's tick across syncs — re-running the audit must
        // never silently un-tick something they told us they'd done.
        claimedDone: prev ? !!prev.claimedDone : false,
        claimedAt: prev ? prev.claimedAt || null : null,
        claimedBy: prev ? prev.claimedBy || null : null,
        verifiedFixed: false,
        verifiedAt: null,
        addedAt: prev ? prev.addedAt || now : now,
      };
    });

  // Anything previously tracked that the audit no longer reports as open.
  existing
    .filter((a) => !openIds.has(a.id))
    .forEach((a) => {
      next.push({
        ...a,
        verifiedFixed: true,
        verifiedAt: a.verifiedAt || now,
      });
    });

  client.actions = next;
  client.updatedAt = now;
  fs.writeFileSync(clientPath(token), JSON.stringify(client, null, 2));
  return next;
}

module.exports = { getClient, listAllClients, createClient, updateClient, saveClientNote, listClientNotes, updateClientNote, deleteClientNote, toggleClientAction, syncClientActions, TOKEN_RE };
