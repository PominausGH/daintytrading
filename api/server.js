require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const contactRoutes = require('./routes/contact');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '16kb' }));

// Global rate limit — safety net
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/contact', contactRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Dainty API listening on :${PORT}`);
});
