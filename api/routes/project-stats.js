const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// api/scripts/update-project-view-stats.py (weekly cron) writes real Umami
// visit counts here. The Astro site is a static build — a cron job can't
// sed numbers into rendered HTML the way it used to, so the frontend fetches
// this endpoint at runtime instead. No rebuild needed when stats update.
const STATS_FILE = path.join(__dirname, '..', 'data', 'project-stats.json');

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', readLimiter, (_req, res) => {
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/json').send(raw);
  } catch (err) {
    res.status(404).json({ error: 'No stats available yet' });
  }
});

module.exports = router;
