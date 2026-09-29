const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendEmail } = require('../lib/email');
const { createService, ServiceError } = require('../lib/sitecheck');
const { clientIp } = require('../lib/client-ip');

const limiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message, code: 'rate_limited' },
  standardHeaders: true,
  legacyHeaders: false,
  // Real visitor IP (see lib/client-ip.js) - req.ip is always a proxy address behind Cloudflare/NPM.
  keyGenerator: (req) => clientIp(req),
});

const handle = (fn) => async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await fn(req));
  } catch (err) {
    if (err instanceof ServiceError) {
      return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
    }
    console.error('[sitecheck] route error:', err && err.stack || err);
    res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'internal' });
  }
};

function buildRouter(service) {
  const router = express.Router();
  const startLimiter = limiter(60 * 60 * 1000, 6, 'Too many checks started from this connection. Please try again later.');
  const resendLimiter = limiter(60 * 60 * 1000, 10, 'Too many code requests. Please try again later.');
  const verifyLimiter = limiter(60 * 60 * 1000, 30, 'Too many attempts. Please try again later.');
  const statusLimiter = limiter(15 * 60 * 1000, 300, 'Too many requests. Please slow down.');

  router.post('/start', startLimiter, handle((req) => service.start({
    domain: req.body.domain,
    email: req.body.email,
    optin: req.body.optin === true || req.body.optin === 'true',
    ip: clientIp(req),
    honeypot: req.body.dt_website,
    loadedAt: req.body.dt_form_loaded_at,
  })));

  router.post('/resend', resendLimiter, handle((req) => service.resend({ sessionId: req.body.sessionId })));

  router.post('/verify', verifyLimiter, handle((req) => service.verify({
    sessionId: req.body.sessionId,
    code: req.body.code,
  })));

  router.get('/status/:jobId', statusLimiter, handle((req) => service.status(req.params.jobId, {
    wait: req.query.wait === '1',
  })));

  router.get('/health', statusLimiter, handle(() => service.health()));
  return router;
}

const router = buildRouter(createService({ sendEmail }));
router.buildRouter = buildRouter;
module.exports = router;
