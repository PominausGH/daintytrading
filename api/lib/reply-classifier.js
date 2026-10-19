'use strict';

// Classifies a reply to a cold prospect email: 'ignored' (an auto-reply or bounce), 'opted_out'
// (they asked us to stop) or 'replied' (a person wrote back). Keep identical to the copy in the
// bizpage-builder repo, which serves the same inbound-reply contract.

const QUOTE_START = [
  /^-{2,}\s*original message/i,
  /^from:\s/i,
  /^_{5,}$/,
  /^sent from my /i,
];

const isOnWrote = (line) => line.startsWith('On ') && line.includes('wrote:');

// Our own email is usually quoted under the reply and its footer has an unsubscribe link, so the
// quoted part is cut before looking for opt-out wording. Cuts from the first quote-header line
// (including "On ... wrote:" wrapped over two lines) and drops any ">" line above it.
function stripQuoted(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (isOnWrote(line) || isOnWrote(`${line} ${next}`)) break;
    if (QUOTE_START.some((re) => re.test(line))) break;
    if (line.startsWith('>')) continue;
    kept.push(lines[i]);
  }
  return kept.join('\n');
}

const AUTO_PRECEDENCE = new Set(['bulk', 'junk', 'list', 'auto_reply']);
const AUTO_SUBJECT = /^\s*(re:\s*)?(auto(matic)?[\s-]?reply|out of (the )?office|away from|undeliverable|delivery status notification|mail delivery (failed|subsystem))/i;

const OPT_OUT = [
  /\bunsubscribe\b/,
  /\bopt[\s-]?out\b/,
  /\bremove (me|us|my|our|this)\b/,
  /\btake (me|us) off\b/,
  /\b(stop|quit) (emailing|e-mailing|sending|contacting|messaging)\b/,
  /\bdo ?n[o']?t (email|e-mail|contact|send)\b/,
  /\bnot interested\b/,
  /\bno,? thanks?\b/,
  /\bno thank you\b/,
  /^\s*stop\.?\s*$/m,
];

const str = (v) => (v == null ? '' : String(v));

function isAutoReply({ subject, auto_submitted, precedence, x_autoreply }) {
  const autoSubmitted = str(auto_submitted).trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') return true;
  if (AUTO_PRECEDENCE.has(str(precedence).trim().toLowerCase())) return true;
  if (str(x_autoreply).trim()) return true;
  return AUTO_SUBJECT.test(str(subject));
}

function classifyReply({ subject, text, auto_submitted, precedence, x_autoreply } = {}) {
  if (isAutoReply({ subject, auto_submitted, precedence, x_autoreply })) return 'ignored';
  const haystack = `${str(subject)}\n${stripQuoted(text)}`.toLowerCase();
  if (OPT_OUT.some((re) => re.test(haystack))) return 'opted_out';
  return 'replied';
}

module.exports = { classifyReply, stripQuoted };
