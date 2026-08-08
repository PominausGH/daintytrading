const spamCheck = (body, textField = 'message') => {
  if (body.dt_website && String(body.dt_website).trim().length > 0) return 'honeypot_filled';
  const loadedAt = parseInt(body.dt_form_loaded_at, 10);
  if (loadedAt && (Date.now() - loadedAt) < 2000) return 'submitted_too_fast';
  const text = String(body[textField] || '').trim();
  const urlMatches = text.match(/https?:\/\/|www\.|\.(com|net|org|ru|cn|biz|info|xyz|top|click)\b/gi) || [];
  if (urlMatches.length > 1) return 'too_many_urls';
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters === letters.toUpperCase()) return 'all_caps';
  const spamWords = /\b(viagra|cialis|casino|crypto.{0,10}invest|bitcoin.{0,10}invest|loan.{0,10}approved|seo.{0,10}service|backlinks?|guest.{0,10}post)\b/i;
  if (spamWords.test(text)) return 'spam_keywords';
  if (/(.)\1{9,}/.test(text)) return 'repeated_chars';
  return null;
};

const sanitize = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/<[^>]*>/g, '');
};

const escapeHtml = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

module.exports = { spamCheck, sanitize, escapeHtml };
