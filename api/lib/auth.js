const crypto = require('crypto');

const SESSION_COOKIE = 'dt_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');
  return secret;
}

function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b); // keep timing constant-ish even on length mismatch
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function createSessionToken() {
  const expiry = Date.now() + SESSION_TTL_MS;
  const payload = String(expiry);
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  const expiry = parseInt(payload, 10);
  return Number.isFinite(expiry) && Date.now() < expiry;
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  });
  return cookies;
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  if (!verifySessionToken(cookies[SESSION_COOKIE])) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

function setSessionCookie(res, token) {
  const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[SESSION_COOKIE]);
}

module.exports = {
  checkPassword,
  createSessionToken,
  verifySessionToken,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  isAuthenticated,
  parseCookies,
};
