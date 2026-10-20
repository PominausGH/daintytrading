require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const contactRoutes = require('./routes/contact');
const reviewsRoutes = require('./routes/reviews');
const statusRoutes = require('./routes/status');
const adminRoutes = require('./routes/admin');
const prospectsRoutes = require('./routes/prospects');
const projectStatsRoutes = require('./routes/project-stats');
const siteCheckRoutes = require('./routes/site-check');
const inboundReply = require('./routes/inbound-reply');
const monitorRoutes = require('./routes/monitor');
const { startSuppressionMonitor } = require('./lib/suppression-monitor');
const { startUptimeMonitor } = require('./lib/uptime-monitor');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// /api/inbound-reply parses its own body (64kb): the worker's 8000-character reply text can pass
// 16kb once JSON-escaped or non-ASCII.
const json16kb = express.json({ limit: '16kb' });
app.use((req, res, next) => (inboundReply.isInboundReplyPath(req.path) ? next() : json16kb(req, res, next)));

// Global rate limit — safety net. The site checker's status polling has its own limiter
// (routes/site-check.js), so it's excluded here or two checks in 15 minutes would trip this one.
// /inbound-reply is excluded too: req.ip is a proxy address (see lib/client-ip.js), so this is one
// bucket shared by every visitor, and a reply must not be dropped because the site was busy. That
// route is behind a bearer secret instead.
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  // /monitor/ is the uptime-watch worker (two calls a minute, bearer secret): same shared-bucket reason.
  skip: (req) => req.path.startsWith('/site-check/') || inboundReply.isInboundReplyPath(`/api${req.path}`) || monitorRoutes.isMonitorPath(`/api${req.path}`),
}));

app.use('/api/contact', contactRoutes);
app.use('/api/site-check', siteCheckRoutes);
app.use('/api/inbound-reply', inboundReply.buildRouter());
app.use('/api/monitor', monitorRoutes.buildRouter());
app.use('/api/reviews', reviewsRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/prospects', prospectsRoutes);
app.use('/api/project-stats', projectStatsRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Dainty API listening on :${PORT}`);
  startSuppressionMonitor();
  startUptimeMonitor();
});
