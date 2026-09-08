const fs = require('fs');
const path = require('path');
const config = require('./config');
const { draftProspectEmail } = require('./prospects-aios');

// Read-only mount from customer-web_check's `reports/` dir (see docker-compose.yml).
// PROSPECTS_REPORTS_DIR lets local/dev runs point at a scratch fixture dir instead.
const REPORTS_ROOT = process.env.PROSPECTS_REPORTS_DIR || path.join(__dirname, '..', 'prospects-reports');
// Writable — same mount clients-store.js already uses for JSON/JSONL data.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SENT_LOG_FILE = path.join(DATA_DIR, 'prospects-sent.json');
const SUPPRESSION_FILE = path.join(DATA_DIR, 'prospects-suppression.json');
const DRAFT_LOG_FILE = path.join(DATA_DIR, 'prospects-draft-log.jsonl');
const VARIANT_COUNTER_FILE = path.join(DATA_DIR, 'prospects-variant-counter.json');
const HEARTBEAT_FILE = path.join(DATA_DIR, 'prospects-heartbeat.json');

// `run` and `slug` become filesystem path segments under the read-only mount, so they're
// validated strictly before ever touching fs — no '.', '/', or '\' allowed at all, which
// also rules out '..' traversal by construction.
const NAME_RE = /^[a-zA-Z0-9_-]+$/;

function isValidName(name) {
  return typeof name === 'string' && NAME_RE.test(name);
}

// Resolve `segments` under `root` and verify the result didn't escape `root` (defense in
// depth beyond NAME_RE — e.g. against a symlink planted inside the mounted dir).
function safeResolve(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  const withSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (target !== resolvedRoot && !target.startsWith(withSep)) return null;
  return target;
}

// Minimal RFC4180-ish CSV parser (quoted fields, "" escaping, CRLF/LF) — no new
// dependency, and this only ever reads summary.csv written by customer-web-check's
// own `csv.DictWriter`, so it doesn't need to handle arbitrary hostile CSV.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => !(r.length === 1 && r[0] === ''))
    .map((r) => {
      const obj = {};
      header.forEach((h, idx) => {
        obj[h] = r[idx] !== undefined ? r[idx] : '';
      });
      return obj;
    });
}

function getRunDir(run) {
  if (!isValidName(run)) return null;
  return safeResolve(REPORTS_ROOT, run);
}

function listRuns() {
  if (!fs.existsSync(REPORTS_ROOT)) return [];
  return fs
    .readdirSync(REPORTS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isValidName(d.name))
    .map((d) => {
      const dir = path.join(REPORTS_ROOT, d.name);
      const summaryPath = path.join(dir, 'summary.csv');
      let count = 0;
      let mtime = null;
      try {
        const stat = fs.statSync(summaryPath);
        mtime = stat.mtime.toISOString();
        count = parseCsv(fs.readFileSync(summaryPath, 'utf8')).length;
      } catch {
        // summary.csv missing or unreadable — still list the run, just with count 0.
      }
      return { name: d.name, count, mtime };
    })
    .sort((a, b) => (b.mtime || '').localeCompare(a.mtime || ''));
}

function slugFromJsonPath(jsonPath) {
  if (!jsonPath) return null;
  const base = path.basename(String(jsonPath), '.json');
  return isValidName(base) ? base : null;
}

function readSentLog() {
  if (!fs.existsSync(SENT_LOG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SENT_LOG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function markSent(run, slug, { to, subject, domain, variant }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const log = readSentLog();
  const record = { sentAt: new Date().toISOString(), to, subject, domain: domain || null, variant: variant || null };
  log[`${run}:${slug}`] = record;
  fs.writeFileSync(SENT_LOG_FILE, JSON.stringify(log, null, 2));
  return record;
}

// Used by the /send route's rate-limit guard — 25/week is well under anything that would
// trip email-provider reputation limits, but is enforced here rather than left to Brevo.
function countSentInLastDays(days) {
  const log = readSentLog();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return Object.values(log).filter((r) => new Date(r.sentAt).getTime() >= cutoff).length;
}

// Returns null if the run directory itself doesn't exist (caller should 404);
// returns [] if the run exists but summary.csv is missing/empty.
function getRunProspects(run) {
  const dir = getRunDir(run);
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const summaryPath = path.join(dir, 'summary.csv');
  if (!fs.existsSync(summaryPath)) return [];

  const rows = parseCsv(fs.readFileSync(summaryPath, 'utf8'));
  const sentLog = readSentLog();

  // summary.csv is already pre-sorted worst-first by the batch tool — preserve that order.
  return rows.map((row) => {
    const slug = slugFromJsonPath(row.json_path);
    const sentRecord = slug ? sentLog[`${run}:${slug}`] : null;
    return {
      url: row.url || '',
      business_name: row.business_name || '',
      contact_email: row.contact_email || '',
      platform: row.platform || '',
      score: row.score === '' || row.score === undefined ? null : Number(row.score),
      findings_count: row.findings_count === '' || row.findings_count === undefined ? null : Number(row.findings_count),
      high_severity_count:
        row.high_severity_count === '' || row.high_severity_count === undefined ? null : Number(row.high_severity_count),
      status: row.status || '',
      error_message: row.error_message || '',
      report_path: row.report_path || '',
      pdf_path: row.pdf_path || '',
      json_path: row.json_path || '',
      slug,
      sent: !!sentRecord,
      sentAt: sentRecord ? sentRecord.sentAt : null,
    };
  });
}

function findSummaryRow(run, slug) {
  const rows = getRunProspects(run) || [];
  return rows.find((r) => r.slug === slug) || null;
}

function getProspectJsonPath(run, slug) {
  if (!isValidName(run) || !isValidName(slug)) return null;
  const dir = safeResolve(REPORTS_ROOT, run);
  if (!dir) return null;
  return safeResolve(dir, `${slug}.json`);
}

function prospectExists(run, slug) {
  const p = getProspectJsonPath(run, slug);
  return !!p && fs.existsSync(p);
}

function readProspectJson(run, slug) {
  const p = getProspectJsonPath(run, slug);
  if (!p || !fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function cleanSiteUrl(url) {
  if (!url || typeof url !== 'string') return 'your site';
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '') || 'your site';
}

// Light cleanup only — trims a trailing bare URL / parenthetical / em-dash aside off a
// finding's .message so it reads reasonably inline in a sentence. Not NLP, just enough
// to turn "Copyright year 2021 is 5 years behind the current year (2026) — footer may be
// stale/unmaintained" into "copyright year 2021 is 5 years behind the current year". This
// is always shown back to the user for editing before send, so imperfect output is fine.
function rephraseFinding(message) {
  if (!message || typeof message !== 'string') return '';
  let text = message.trim();
  // Drop a trailing " — aside" clause. Only em/en dash count as the separator here —
  // a plain ASCII hyphen is excluded on purpose, since it shows up constantly inside
  // ordinary compound words/headers (e.g. "X-Frame-Options", "frame-ancestors") and
  // would otherwise wrongly break the match or truncate mid-word.
  text = text.replace(/\s+[—–]\s+[^—–]+$/, '');
  // Drop a trailing parenthetical.
  text = text.replace(/\s*\([^)]*\)\s*$/, '');
  // Drop a trailing bare URL (optionally backtick-wrapped, optionally after a colon).
  text = text.replace(/:?\s*`?https?:\/\/\S+`?\s*$/i, '');
  // Trim any leftover trailing colon/whitespace.
  text = text.replace(/[:\s]+$/, '');
  if (!text) return message.trim();
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// Mirrors customer_web_check's own src/customer_web_check/scoring.py Severity weights exactly,
// so "how bad" agrees between the audit tool's score and the pick made here.
const SEVERITY_WEIGHT = { info: 0, low: 1, medium: 3, high: 7, critical: 15 };

// customer-web-check has no GBP/traffic data (the original spec assumed a "visibility" field
// that doesn't exist in the real report schema) — visibility here is a per-category heuristic
// for "how likely is a real customer to actually notice this", not a measured signal. effortMins
// is a rough guess at fix time. Both are deliberately coarse; tune via testing real replies
// rather than trying to model this more precisely up front.
const CATEGORY_META = {
  product_sanity: { visibility: 5, effortMins: 45 },
  placeholder_copy: { visibility: 5, effortMins: 20 },
  broken_link: { visibility: 4, effortMins: 15 },
  accc_claims: { visibility: 3, effortMins: 30 },
  page_bloat: { visibility: 3, effortMins: 60 },
  social_meta: { visibility: 3, effortMins: 15 },
  wp_plugins: { visibility: 2, effortMins: 20 },
  copyright_year: { visibility: 2, effortMins: 5 },
  security_headers: { visibility: 1, effortMins: 15 },
};
const DEFAULT_CATEGORY_META = { visibility: 2, effortMins: 30 };

function findingScore(finding) {
  const severityWeight = SEVERITY_WEIGHT[finding.severity] || 0;
  const meta = CATEGORY_META[finding.category] || DEFAULT_CATEGORY_META;
  return (severityWeight * meta.visibility) / meta.effortMins;
}

// Picks exactly one finding — the spec is explicit that two dilutes the email. info/low
// severity findings (crawl noise, platform-detection notes, a stale copyright year) are never
// worth a cold email on their own, so they're excluded from candidacy outright rather than
// just scoring low. Returns null if nothing clears config.prospectsMinFindingScore.
function selectTopFinding(findings) {
  const candidates = (Array.isArray(findings) ? findings : [])
    .filter((f) => f && (f.severity === 'medium' || f.severity === 'high' || f.severity === 'critical'))
    .map((f) => ({ finding: f, score: findingScore(f) }))
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  if (!top || top.score < config.prospectsMinFindingScore) return null;
  return top;
}

function getDomain(url) {
  if (!url || typeof url !== 'string') return null;
  return url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase() || null;
}

function readJsonSafe(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Flat list of lowercased domains/emails. No dedicated admin UI for this yet — edit the file
// directly, or wire up an endpoint if this needs to be self-serve later.
function readSuppressionList() {
  return readJsonSafe(SUPPRESSION_FILE, []);
}

function isSuppressed(...values) {
  const list = readSuppressionList().map((v) => String(v).toLowerCase());
  return values.filter(Boolean).some((v) => list.includes(String(v).toLowerCase()));
}

// Scans the sent log for the most recent send to the same domain, regardless of which
// run/slug it came from — a prospect re-appearing in next month's batch under the same
// domain must not get emailed again inside the cooldown window.
function findRecentSendForDomain(domain) {
  if (!domain) return null;
  const log = readSentLog();
  let mostRecent = null;
  for (const record of Object.values(log)) {
    if (record.domain !== domain) continue;
    if (!mostRecent || record.sentAt > mostRecent.sentAt) mostRecent = record;
  }
  return mostRecent;
}

function daysSince(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

// Alternates A/B globally across all drafts (not per-domain) so the split stays even
// regardless of which prospects get opened for review on a given day.
function nextVariant() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const state = readJsonSafe(VARIANT_COUNTER_FILE, { count: 0 });
  const variant = state.count % 2 === 0 ? 'A' : 'B';
  fs.writeFileSync(VARIANT_COUNTER_FILE, JSON.stringify({ count: state.count + 1 }, null, 2));
  return variant;
}

function appendDraftLog(entry) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(DRAFT_LOG_FILE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

// Written on every draft-generation attempt (not just successes) — this is the file the
// heartbeat monitor reads to tell "no prospects worth emailing this batch" apart from
// "the pipeline silently stopped running". See customer-web_check/run-monthly-batch.sh for
// the audit-side heartbeat this pairs with.
//
// Only 'pending' and 'auto_rejected' represent the LLM actually being called — 'suppressed',
// 'cooldown', and 'skipped_below_threshold' are gates that fire before that call, so counting
// them as "generated" would mask a real silent failure (e.g. AIOS unreachable) behind a run
// that only ever hit prospects already in cooldown.
const ZERO_COUNTS = { generated24h: 0, autoRejected24h: 0, errors24h: 0 };
function touchHeartbeat(status) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const existing = readJsonSafe(HEARTBEAT_FILE, ZERO_COUNTS);
  const now = new Date().toISOString();
  const sameWindow = existing.windowStart && daysSince(existing.windowStart) < 1;
  const windowStart = sameWindow ? existing.windowStart : now;
  const counts = sameWindow ? existing : ZERO_COUNTS;
  fs.writeFileSync(
    HEARTBEAT_FILE,
    JSON.stringify(
      {
        lastCheckedAt: now,
        windowStart,
        generated24h: counts.generated24h + (status === 'pending' ? 1 : 0),
        autoRejected24h: counts.autoRejected24h + (status === 'auto_rejected' ? 1 : 0),
        errors24h: counts.errors24h + (status === 'error' ? 1 : 0),
      },
      null,
      2
    )
  );
}

// The 90-word cap and AU-voice instructions live in the prompt, but the model doesn't
// reliably honour a word cap on its own — enforce it here rather than trusting compliance.
function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// A generic subject ("Quick question", "Noticed something") defeats the whole point of
// naming the defect concretely — reject a subject that doesn't share any real vocabulary
// with the finding it's supposedly about.
function isConcreteSubject(subject, findingMessage) {
  if (!subject || subject.length > 120) return false;
  const stopwords = new Set(['your', 'site', 'about', 'quick', 'note', 'website', 'the', 'a', 'an', 'and', 'for', 'with', 'this', 'that']);
  const subjectWords = new Set(
    subject.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter((w) => !stopwords.has(w)) || []
  );
  const findingWords = new Set(
    (findingMessage || '').toLowerCase().match(/[a-z0-9]{4,}/g)?.filter((w) => !stopwords.has(w)) || []
  );
  for (const w of subjectWords) {
    if (findingWords.has(w)) return true;
  }
  return false;
}

// Returns { status: 'pending' | 'auto_rejected' | 'skipped_below_threshold' | 'suppressed' | 'cooldown',
//           subject, body, confidence, variant, reason, contactEmail }
// subject/body are '' when status isn't 'pending' or 'auto_rejected' — there's nothing to send.
async function buildDraft(run, slug) {
  const data = readProspectJson(run, slug);
  if (!data) return null;

  const row = findSummaryRow(run, slug);
  const businessName =
    (row && row.business_name && row.business_name.trim()) ||
    (data.abr && data.abr.entity_name) ||
    null;
  const label = businessName || cleanSiteUrl(data.site_url);
  const contactEmail = (row && row.contact_email) || data.contact_email || null;
  const domain = getDomain((row && row.url) || data.site_url);

  if (isSuppressed(domain, contactEmail)) {
    touchHeartbeat('suppressed');
    return { status: 'suppressed', subject: '', body: '', confidence: null, variant: null, reason: 'Domain or contact is on the suppression list.', contactEmail };
  }

  const recentSend = findRecentSendForDomain(domain);
  if (recentSend && daysSince(recentSend.sentAt) < config.prospectsCooldownDays) {
    touchHeartbeat('cooldown');
    return {
      status: 'cooldown',
      subject: '',
      body: '',
      confidence: null,
      variant: null,
      reason: `Already emailed this domain ${Math.floor(daysSince(recentSend.sentAt))} days ago (cooldown is ${config.prospectsCooldownDays} days).`,
      contactEmail,
    };
  }

  // Deliberately picks ONE finding, not two — the spec is explicit that two dilutes an
  // otherwise sharp email. Dedupe-by-message still applies (see rephraseFinding/describe
  // logic this replaces) since selectTopFinding operates on raw findings, and a recurring
  // check produces one finding per page with identical .message text; scoring the same
  // message twice doesn't change which message wins, just how loudly.
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const top = selectTopFinding(findings);
  if (!top) {
    touchHeartbeat('skipped_below_threshold');
    return { status: 'skipped_below_threshold', subject: '', body: '', confidence: null, variant: null, reason: 'No finding scored high enough to justify an email.', contactEmail };
  }

  const findingMessage = rephraseFinding(top.finding.message);
  const variant = nextVariant();

  let draft;
  try {
    draft = await draftProspectEmail({
      businessName: label,
      niche: data.platform,
      findingMessage,
      proofLine: config.shuttersmithProofLine,
      variant,
    });
  } catch (err) {
    appendDraftLog({ run, slug, domain, status: 'error', variant, error: err.message });
    touchHeartbeat('error');
    throw err;
  }

  const words = wordCount(draft.body);
  const reasons = [];
  if (draft.confidence < config.prospectsConfidenceThreshold) reasons.push(`confidence ${draft.confidence} below ${config.prospectsConfidenceThreshold}`);
  if (words > config.prospectsMaxWords) reasons.push(`body is ${words} words (max ${config.prospectsMaxWords})`);
  if (!draft.subject || !draft.body) reasons.push('missing subject or body');
  if (draft.subject && !isConcreteSubject(draft.subject, findingMessage)) reasons.push('subject reads generic, not tied to the actual finding');

  const status = reasons.length ? 'auto_rejected' : 'pending';

  appendDraftLog({
    run,
    slug,
    domain,
    status,
    variant,
    confidence: draft.confidence,
    findingCategory: top.finding.category,
    findingScore: top.score,
    reasons: reasons.length ? reasons : undefined,
  });
  touchHeartbeat(status);

  return {
    status,
    subject: draft.subject,
    body: draft.body,
    confidence: draft.confidence,
    variant,
    reason: reasons.join('; ') || null,
    contactEmail,
  };
}

module.exports = {
  isValidName,
  listRuns,
  getRunProspects,
  prospectExists,
  buildDraft,
  markSent,
  cleanSiteUrl,
  rephraseFinding,
  getDomain,
  isSuppressed,
  countSentInLastDays,
};
