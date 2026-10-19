'use strict';
const crypto = require('crypto');
const express = require('express');
const config = require('../lib/config');
const store = require('../lib/prospects-store');
const { classifyReply } = require('../lib/reply-classifier');

// POST /api/inbound-reply — a Cloudflare Email Worker forwards each reply to a prospect email here.
// Opt-outs suppress the sender automatically; any real reply marks the prospect replied so the
// follow-up never goes out. Same contract and classifier as bizpage-builder's endpoint.

function secretMatches(header, secret) {
  const m = typeof header === 'string' && header.match(/^Bearer\s+(.+)$/i);
  const a = crypto.createHash('sha256').update(m ? m[1].trim() : '').digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b) && !!m;
}

const str = (v) => (typeof v === 'string' ? v : '');

function buildRouter({ secret = config.inboundReplySecret } = {}) {
  const router = express.Router();
  // Checked before the body is parsed, so an unauthenticated caller gets nothing parsed or stored.
  const auth = (req, res, next) => {
    if (!secret) return res.status(503).json({ error: 'not_configured' });
    if (!secretMatches(req.headers.authorization, secret)) return res.status(401).json({ error: 'unauthorized' });
    next();
  };
  router.post('/', auth, express.json({ limit: '64kb' }), (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const from = store.normalizeAddress(str(body.from));
    if (!from) return res.status(400).json({ error: 'invalid_from' });

    const classified = classifyReply({
      subject: str(body.subject), text: str(body.text),
      auto_submitted: str(body.auto_submitted), precedence: str(body.precedence), x_autoreply: str(body.x_autoreply),
    });
    const { result, matched } = store.applyInboundReply(from, classified);

    console.log(`inbound-reply: @${from.split('@')[1]} -> ${result} (matched ${matched})`);
    try {
      store.appendInboundReplyLog({
        at: new Date().toISOString(), from, result, matched, subject: str(body.subject).slice(0, 120),
      });
    } catch (err) {
      console.error('inbound-reply: audit log write failed:', err.message);
    }
    res.json({ result, matched });
  });
  return router;
}

const isInboundReplyPath = (p) => /^\/api\/inbound-reply\/?$/.test(p);

module.exports = { buildRouter, secretMatches, isInboundReplyPath };
