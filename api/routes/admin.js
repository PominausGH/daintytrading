const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getClient,
  listAllClients,
  createClient,
  updateClient,
  saveClientNote,
  listClientNotes,
  updateClientNote,
  deleteClientNote,
} = require('../lib/clients-store');
const { checkPassword, createSessionToken, requireAdmin, setSessionCookie, clearSessionCookie, isAuthenticated } = require('../lib/auth');
const { sanitize } = require('../lib/security');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  setSessionCookie(res, createSessionToken());
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

// Everything below requires a valid admin session.
router.use(requireAdmin);

router.get('/clients', (req, res) => {
  res.json({ clients: listAllClients() });
});

router.get('/clients/:token', (req, res) => {
  const client = getClient(req.params.token);
  if (!client) return res.status(404).json({ error: 'Not found' });
  res.json({ ...client, noteHistory: listClientNotes(req.params.token) });
});

router.post('/clients', (req, res) => {
  const { name, project } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Client name is required' });
  }
  if (!project || typeof project !== 'string' || !project.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  const record = createClient({ name: sanitize(name), project: sanitize(project) });
  res.status(201).json(record);
});

router.patch('/clients/:token', (req, res) => {
  const fields = {};
  ['status', 'phase', 'nextMilestone', 'notes', 'notifyEmail', 'clientName', 'project'].forEach((key) => {
    if (req.body && req.body[key] !== undefined) fields[key] = sanitize(String(req.body[key]));
  });
  const updated = updateClient(req.params.token, fields);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json(updated);
});

router.post('/clients/:token/notes', (req, res) => {
  const client = getClient(req.params.token);
  if (!client) return res.status(404).json({ error: 'Not found' });
  const { note, targetDate, name } = req.body || {};
  if (!note || typeof note !== 'string' || !note.trim()) {
    return res.status(400).json({ error: 'Note text is required' });
  }
  const record = saveClientNote(req.params.token, {
    name: sanitize(name) || 'Dainty Trading',
    note: sanitize(note),
    targetDate: targetDate ? sanitize(targetDate) : null,
    author: 'studio',
  });
  res.status(201).json(record);
});

router.patch('/clients/:token/notes/:noteId', (req, res) => {
  const { note, targetDate } = req.body || {};
  const updated = updateClientNote(req.params.token, req.params.noteId, {
    note: note != null ? sanitize(note) : undefined,
    targetDate: targetDate !== undefined ? sanitize(String(targetDate || '')) : undefined,
  });
  if (!updated) return res.status(404).json({ error: 'Note not found' });
  res.json(updated);
});

router.delete('/clients/:token/notes/:noteId', (req, res) => {
  const deleted = deleteClientNote(req.params.token, req.params.noteId);
  if (!deleted) return res.status(404).json({ error: 'Note not found' });
  res.json({ success: true });
});

module.exports = router;
