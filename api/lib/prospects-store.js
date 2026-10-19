const fs = require('fs');
const path = require('path');
const config = require('./config');
const { toOpenerFindings } = require('./prospects-sitecheck');
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
const DRAFTS_FILE = path.join(DATA_DIR, 'prospects-drafts.json');
const SKIPS_FILE = path.join(DATA_DIR, 'prospects-skipped.json');
const PREDRAFT_STATE_FILE = path.join(DATA_DIR, 'prospects-predraft-state.json');
const PREDRAFT_LOCK_FILE = path.join(DATA_DIR, 'prospects-predraft.lock');
const INBOUND_REPLY_LOG_FILE = path.join(DATA_DIR, 'inbound-replies.jsonl');

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

// `domain` is the recipient address's domain (kept for old records); `siteDomain` is the
// business's website. They differ whenever a business uses a Gmail or ISP address, and it is the
// website that identifies the business for the cooldown and opt-out checks.
function markSent(run, slug, { to, subject, domain, siteDomain, variant }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const log = readSentLog();
  const record = {
    sentAt: new Date().toISOString(), to, subject, domain: domain || null, siteDomain: siteDomain || null, variant: variant || null,
  };
  log[`${run}:${slug}`] = record;
  fs.writeFileSync(SENT_LOG_FILE, JSON.stringify(log, null, 2));
  return record;
}

function getSentRecord(run, slug) {
  return readSentLog()[`${run}:${slug}`] || null;
}

function updateSentRecord(run, slug, patch) {
  const log = readSentLog();
  const key = `${run}:${slug}`;
  if (!log[key]) return null;
  log[key] = { ...log[key], ...patch };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SENT_LOG_FILE, JSON.stringify(log, null, 2));
  return log[key];
}

// Used by the /send route's rate-limit guard — 25/week is well under anything that would
// trip email-provider reputation limits, but is enforced here rather than left to Brevo.
// A follow-up is an email too, so it counts toward the same cap.
function countSentInLastDays(days) {
  const log = readSentLog();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = (iso) => !!iso && new Date(iso).getTime() >= cutoff;
  return Object.values(log).reduce((n, r) => n + (recent(r.sentAt) ? 1 : 0) + (recent(r.followUp && r.followUp.sentAt) ? 1 : 0), 0);
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
      contact_email: (row.contact_email || '').trim(),
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
      ...(sentRecord ? sequenceSummary(sentRecord) : {}),
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
  page_bloat: { visibility: 3, effortMins: 60 },
  social_meta: { visibility: 3, effortMins: 15 },
  wp_plugins: { visibility: 2, effortMins: 20 },
  copyright_year: { visibility: 2, effortMins: 5 },
  security_headers: { visibility: 1, effortMins: 15 },
};
const DEFAULT_CATEGORY_META = { visibility: 2, effortMins: 30 };

// Categories an email never leads with, whatever their severity. accc_claims ("Australian Made"
// with no certification mentioned nearby) is the only check the audit rates `high`, and it fires
// once per mention, so it used to win the opener on any site without a broken link (11 of 44
// audited sites, 2026-10-12). It is a compliance question for the business, not something we
// fix; the audit can't tell whether the claim is true; and it opens a cold email with an
// accusation. It still appears in the full audit report.
const NON_OPENER_CATEGORIES = new Set(['accc_claims']);

// Findings from our own site checker (lib/prospects-sitecheck.js) are the SEO/GEO side, which is
// what we sell, so a medium findability problem is weighted to outrank a broken link (1.0+ vs
// 0.8). Same coarse visibility/effort heuristic as above, by checker group, with a few ids set
// by hand: the three that take a site out of search altogether, and an order among the common
// medium ones so the strongest leads when a site has several. Security only leads when it is
// `high` (no HTTPS, a broken certificate, end-of-life software); speed and measurement never
// clear prospectsMinFindingScore, since one request can't prove a site is slow and missing
// analytics is not something the owner feels.
const SITECHECK_GROUP_META = {
  findability: { visibility: 5, effortMins: 15 },
  security: { visibility: 4, effortMins: 30 },
  speed: { visibility: 4, effortMins: 30 },
  measurement: { visibility: 2, effortMins: 15 },
};
const SITECHECK_ID_META = {
  noindex_home: { visibility: 5, effortMins: 10 },
  robots_blocks_all: { visibility: 5, effortMins: 10 },
  missing_title: { visibility: 5, effortMins: 10 },
  ai_crawlers_blocked: { visibility: 5, effortMins: 10 },
  missing_description: { visibility: 5, effortMins: 12 },
  no_viewport: { visibility: 5, effortMins: 12 },
  sitemap_broken: { visibility: 4, effortMins: 10 },
  canonical_mismatch: { visibility: 3, effortMins: 15 },
};

function findingMeta(finding) {
  if (finding.source === 'sitecheck') {
    return SITECHECK_ID_META[finding.id] || SITECHECK_GROUP_META[finding.group] || DEFAULT_CATEGORY_META;
  }
  return CATEGORY_META[finding.category] || DEFAULT_CATEGORY_META;
}

function findingScore(finding) {
  const severityWeight = SEVERITY_WEIGHT[finding.severity] || 0;
  const meta = findingMeta(finding);
  return (severityWeight * meta.visibility) / meta.effortMins;
}

// Picks exactly one finding — the spec is explicit that two dilutes the email. info/low
// severity findings (crawl noise, platform-detection notes, a stale copyright year) are never
// worth a cold email on their own, so they're excluded from candidacy outright rather than
// just scoring low. Returns null if nothing clears config.prospectsMinFindingScore.
function selectTopFinding(findings) {
  const candidates = (Array.isArray(findings) ? findings : [])
    .filter((f) => f && (f.severity === 'medium' || f.severity === 'high' || f.severity === 'critical'))
    .filter((f) => !NON_OPENER_CATEGORIES.has(f.category))
    .map((f) => ({ finding: f, score: findingScore(f) }))
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  if (!top || top.score < config.prospectsMinFindingScore) return null;
  return top;
}

// Picks the case-study proof line matching the prospect's vertical (set by
// customer-web_check's sourcing pipeline), falling back to `default` for
// manually-authored runs that don't set one or set an unrecognized value.
function selectProofLine(vertical) {
  const lines = config.prospectsProofLines || {};
  if (vertical && lines[vertical]) return lines[vertical];
  return lines.default;
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
    // siteDomain is the business's website; `domain` alone (the recipient's address) let a
    // business on a Gmail address through the cooldown.
    if (record.siteDomain !== domain && record.domain !== domain) continue;
    if (!mostRecent || record.sentAt > mostRecent.sentAt) mostRecent = record;
  }
  return mostRecent;
}

function daysSince(isoDate) {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

// ---- after the first email: replies, opt-outs and the one follow-up -------------------------
//
// The sequence is two emails at most: the first, then one follow-up a week of working days
// later if they haven't replied or opted out. After that we don't email the business again.
// "Replied" and "opted out" are recorded by a person in the dashboard, or automatically when the
// inbound email worker forwards a reply to POST /api/inbound-reply (applyInboundReply below).

function siteDomainFor(run, slug) {
  const row = findSummaryRow(run, slug);
  const data = row && row.url ? null : readProspectJson(run, slug);
  return getDomain((row && row.url) || (data && data.site_url) || '');
}

function markReplied(run, slug, replied = true) {
  return updateSentRecord(run, slug, { repliedAt: replied ? new Date().toISOString() : null });
}

function addToSuppression(values) {
  const list = readSuppressionList().map((v) => String(v).toLowerCase());
  const added = [];
  for (const v of values.filter(Boolean).map((x) => String(x).trim().toLowerCase())) {
    if (v && !list.includes(v)) { list.push(v); added.push(v); }
  }
  if (added.length) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SUPPRESSION_FILE, JSON.stringify(list, null, 2));
  }
  return added;
}

// Suppresses the address we wrote to and the business's website. Never the address's own domain
// unless it is their website: suppressing "gmail.com" would block every prospect on Gmail.
function optOut(run, slug) {
  const record = getSentRecord(run, slug);
  if (!record) return null;
  const site = record.siteDomain || siteDomainFor(run, slug);
  const added = addToSuppression([record.to, site]);
  const updated = updateSentRecord(run, slug, { optedOutAt: new Date().toISOString(), siteDomain: site || record.siteDomain || null });
  return { record: updated, suppressed: added };
}

// "Name <A@B.com>" or " a@b.com " -> "a@b.com"; null if it isn't an address.
function normalizeAddress(value) {
  if (typeof value !== 'string') return null;
  const angle = value.match(/<([^<>]*)>/);
  const addr = (angle ? angle[1] : value).trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(addr) ? addr : null;
}

// Every sent record whose recipient is exactly this address (no domain matching).
function findSentByAddress(address) {
  const addr = normalizeAddress(address);
  if (!addr) return [];
  return Object.entries(readSentLog())
    .filter(([, record]) => normalizeAddress(record.to) === addr)
    .map(([key, record]) => {
      const i = key.indexOf(':');
      return { run: key.slice(0, i), slug: key.slice(i + 1), record };
    });
}

// Acts on a classified inbound reply. An opt-out always suppresses the sender's address, matched or
// not; each matched record is opted out (address + website, as in the dashboard) and marked replied.
// A real reply marks matched records replied, which stops the follow-up. A first repliedAt is kept.
function applyInboundReply(from, result) {
  const addr = normalizeAddress(from);
  if (result === 'ignored' || !addr) return { result, matched: 0 };
  const matches = findSentByAddress(addr);
  if (result === 'opted_out') addToSuppression([addr]);
  for (const { run, slug, record } of matches) {
    if (result === 'opted_out' && !record.optedOutAt) {
      if (isValidName(run) && isValidName(slug)) optOut(run, slug);
      else {
        addToSuppression([record.to, record.siteDomain]);
        updateSentRecord(run, slug, { optedOutAt: new Date().toISOString() });
      }
    }
    if (!record.repliedAt) markReplied(run, slug);
  }
  if (!matches.length && result !== 'opted_out') return { result: 'no_match', matched: 0 };
  return { result, matched: matches.length };
}

function appendInboundReplyLog(entry) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(INBOUND_REPLY_LOG_FILE, JSON.stringify(entry) + '\n');
}

function addBusinessDays(from, days) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return d;
}

function followUpDueAt(record) {
  return addBusinessDays(record.sentAt, config.prospectsFollowUpBusinessDays);
}

// 'not_sent' | 'opted_out' | 'replied' | 'done' (follow-up sent) | 'not_due' | 'due'
function followUpState(record, now = Date.now()) {
  if (!record) return 'not_sent';
  if (record.optedOutAt || isSuppressed(record.to, record.siteDomain)) return 'opted_out';
  if (record.repliedAt) return 'replied';
  if (record.followUp && record.followUp.sentAt) return 'done';
  return now >= followUpDueAt(record).getTime() ? 'due' : 'not_due';
}

function sequenceSummary(record) {
  return {
    replied: !!record.repliedAt,
    optedOut: !!record.optedOutAt,
    followUpState: followUpState(record),
    followUpDueAt: followUpDueAt(record).toISOString(),
    followUpSentAt: (record.followUp && record.followUp.sentAt) || null,
  };
}

const day = (iso) => String(iso || '').slice(0, 10);
const FOLLOW_UP_REASON = {
  not_sent: () => 'No first email has been sent to this prospect.',
  opted_out: () => "They opted out. We don't email them again.",
  replied: (r) => `They replied (marked ${day(r.repliedAt)}). No follow-up.`,
  done: (r) => `Follow-up already sent on ${day(r.followUp.sentAt)}. Two emails is the limit.`,
  not_due: (r) => `Follow-up is due on ${day(followUpDueAt(r).toISOString())}, ${config.prospectsFollowUpBusinessDays} working days after the first email.`,
  due: () => null,
};

// The follow-up is a fixed short note, not a model call: it makes no new claim about their site,
// so there is nothing for a model to get wrong, and it costs nothing. The greeting is lifted from
// the first email so both address the business the same way.
function buildFollowUp(run, slug) {
  const record = getSentRecord(run, slug);
  const state = followUpState(record);
  const base = {
    state,
    to: record ? record.to : null,
    sentAt: record ? record.sentAt : null,
    dueAt: record ? followUpDueAt(record).toISOString() : null,
    reason: FOLLOW_UP_REASON[state](record),
  };
  if (state !== 'due') return { ...base, subject: '', body: '' };

  const saved = getSavedDraft(run, slug);
  const firstLine = ((saved && saved.body) || '').split('\n')[0].trim();
  const greeting = /^Hi\b.{0,80},$/.test(firstLine) ? firstLine : 'Hi,';
  const subject = /^re:/i.test(record.subject || '') ? record.subject : `Re: ${record.subject || 'your website'}`;
  const body = [
    greeting,
    `Following up on my earlier note about your website${record.subject ? ` ("${record.subject}")` : ''}.`,
    "Happy to send the full report: no cost, and no call needed. If it's not of interest, just say so and I won't email again.",
    config.prospectsGuaranteeLine,
    config.prospectsSignature,
  ].filter(Boolean).join('\n\n');
  return { ...base, subject, body };
}

function markFollowUpSent(run, slug, { subject }) {
  return updateSentRecord(run, slug, { followUp: { sentAt: new Date().toISOString(), subject } });
}

// Every first email still waiting on its follow-up, soonest first, across all runs.
function listFollowUps() {
  return Object.entries(readSentLog())
    .map(([key, record]) => {
      const i = key.indexOf(':');
      const run = key.slice(0, i);
      const slug = key.slice(i + 1);
      const state = followUpState(record);
      if (state !== 'due' && state !== 'not_due') return null;
      const row = isValidName(run) && isValidName(slug) ? findSummaryRow(run, slug) : null;
      return {
        run, slug, state, to: record.to, sentAt: record.sentAt, dueAt: followUpDueAt(record).toISOString(),
        label: (row && row.business_name && row.business_name.trim()) || (row && row.url) || record.siteDomain || record.to,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

function outreachStats() {
  const records = Object.values(readSentLog());
  return {
    sent: records.length,
    replied: records.filter((r) => r.repliedAt).length,
    optedOut: records.filter((r) => r.optedOutAt).length,
    followUpsSent: records.filter((r) => r.followUp && r.followUp.sentAt).length,
    followUpsDue: records.filter((r) => followUpState(r) === 'due').length,
    sentLast7Days: countSentInLastDays(7),
    weeklyLimit: config.prospectsRateLimitPerWeek,
  };
}

// Two emails with no reply ends it for good, not just for the cooldown window.
function findFinishedSequenceForDomain(domain) {
  if (!domain) return null;
  return Object.values(readSentLog()).find((r) =>
    (r.siteDomain === domain || r.domain === domain) && r.followUp && r.followUp.sentAt && !r.repliedAt) || null;
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

// A generic subject ("Quick question", "Noticed something") defeats the whole point of naming
// the defect concretely, so those are rejected.
//
// This used to require the subject to share a word with the finding's text. That rejected good
// subjects, twice in two days: "your site blocks ChatGPT and Claude" (the finding says "AI
// assistants") and "your Brisbane locations page shows a blank preview when shared" (the finding
// says "missing og:image"). A good subject restates a technical label in the owner's words, so
// sharing no word with it is normal, not a sign of being generic.
//
// So it now rejects what is actually generic: nothing there, too long, a stock filler phrase, or
// too few real words to say anything. Sharing a word with the finding still passes a subject
// outright, filler phrase or not ("quick note about your broken link").
const GENERIC_SUBJECT = /\b(quick (question|note|one|chat|word|thought)|noticed something|just checking|checking in|touching base|following up|hello|hi there|an idea|a thought|opportunity|partnership|collaboration|introduction)\b/i;
const SUBJECT_STOPWORDS = new Set(['your', 'site', 'about', 'quick', 'note', 'website', 'the', 'a', 'an', 'and', 'for', 'with', 'this', 'that']);

function subjectWords(text) {
  return ((text || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter((w) => !SUBJECT_STOPWORDS.has(w));
}

function isConcreteSubject(subject, findingMessage) {
  if (!subject || subject.length > 120) return false;
  const words = subjectWords(subject);
  const findingWords = new Set(subjectWords(findingMessage));
  if (words.some((w) => findingWords.has(w))) return true;
  if (GENERIC_SUBJECT.test(subject)) return false;
  return words.length >= 3;
}

// The auto-reject gates, as a function of the draft alone so a saved draft can be judged again
// against today's thresholds without calling the model.
function isLowConfidence(confidence) {
  return typeof confidence === 'number' && confidence < config.prospectsConfidenceThreshold;
}

function gateReasons({ subject, body, subjectContext }) {
  const words = wordCount(body);
  const reasons = [];
  // Confidence is not a gate any more (2026-10-13). It is the drafting model's own guess and it
  // doesn't separate good drafts from weak ones: the same prospect and finding scored 0.58 to
  // 0.74 across nine live drafts, while weak broken-link drafts scored 0.5 to 0.62. Any
  // cut-off in that band rejects good drafts at random. It is shown to the reviewer as a label
  // instead (isLowConfidence), and a person approves every email before it is sent.
  if (words > config.prospectsMaxWords) reasons.push(`body is ${words} words (max ${config.prospectsMaxWords})`);
  if (!subject || !body) reasons.push('missing subject or body');
  if (subject && !isConcreteSubject(subject, subjectContext)) reasons.push('subject reads generic, not tied to the actual finding');
  return reasons;
}

// Every generated draft is kept, keyed by run and prospect, so opening a prospect again shows the
// email already written instead of paying for a new model call (and getting a different email).
// Only "Regenerate" (fresh) writes a new one. Stored without the signature, which is added on
// the way out so a signature change applies to saved drafts too.
function getSavedDraft(run, slug) {
  const saved = readJsonSafe(DRAFTS_FILE, {})[`${run}:${slug}`];
  return saved && typeof saved.subject === 'string' && typeof saved.body === 'string' ? saved : null;
}

function saveDraft(run, slug, draft) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const all = readJsonSafe(DRAFTS_FILE, {});
    all[`${run}:${slug}`] = draft;
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(all, null, 2));
  } catch (err) {
    // Losing the saved copy only costs a regeneration later; it must not fail the draft itself.
    console.error('prospects: could not save draft:', err.message);
  }
}

// Body, then the guarantee (omitted when configured empty), then the signature.
function withClosing(body) {
  return [body, config.prospectsGuaranteeLine, config.prospectsSignature].filter(Boolean).join('\n\n');
}

function draftResponse(draft, contactEmail, extra = {}) {
  const reasons = gateReasons(draft);
  return {
    status: reasons.length ? 'auto_rejected' : 'pending',
    subject: draft.subject,
    // Guarantee and signature appended after the gates (which must judge only the AI's actual
    // pitch, not fixed boilerplate) but included in what's returned for review/edit/send. Saved
    // drafts are stored without either, so a change to them applies to saved drafts too.
    body: draft.body ? withClosing(draft.body) : draft.body,
    confidence: draft.confidence,
    lowConfidence: isLowConfidence(draft.confidence),
    variant: draft.variant,
    reason: reasons.join('; ') || null,
    contactEmail,
    leadsWith: draft.leadsWith || null,
    siteCheck: draft.siteCheck || null,
    generatedAt: draft.generatedAt || null,
    ...extra,
  };
}

// Set once by routes/prospects.js. Left unset (tests, or the checker not wired), drafts use the
// audit's findings alone, as they did before.
let siteCheck = null;
function setSiteCheck(provider) {
  siteCheck = provider;
}

// The host the checker should look at: the prospect's address as audited, www and all.
function siteHost(siteUrl, fallbackDomain) {
  try {
    return new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`).hostname.toLowerCase() || fallbackDomain;
  } catch {
    return fallbackDomain;
  }
}

// Returns { status: 'pending' | 'auto_rejected' | 'skipped_below_threshold' | 'suppressed' | 'cooldown' | 'checking',
//           subject, body, confidence, variant, reason, contactEmail, leadsWith, siteCheck }
// subject/body are '' when status isn't 'pending' or 'auto_rejected' — there's nothing to send.
// 'checking' means the site check for this prospect is still running: ask again in
// retryAfterSeconds (the dashboard does this itself).
// A draft already written for this prospect is returned as saved (`saved: true`, no model call)
// unless `fresh` is set, which is what the dashboard's Regenerate button sends.
async function buildDraft(run, slug, { fresh = false } = {}) {
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

  if (findFinishedSequenceForDomain(domain)) {
    touchHeartbeat('cooldown');
    return {
      status: 'finished',
      subject: '',
      body: '',
      confidence: null,
      variant: null,
      reason: "Two emails already went to this business with no reply. We don't email them again.",
      contactEmail,
    };
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

  if (!fresh) {
    const saved = getSavedDraft(run, slug);
    if (saved) return draftResponse(saved, contactEmail, { saved: true });
  }

  // Deliberately picks ONE finding, not two — the spec is explicit that two dilutes an
  // otherwise sharp email. Dedupe-by-message still applies (see rephraseFinding/describe
  // logic this replaces) since selectTopFinding operates on raw findings, and a recurring
  // check produces one finding per page with identical .message text; scoring the same
  // message twice doesn't change which message wins, just how loudly.
  //
  // SEO/GEO findings from our own site checker join the audit's findings here. After the
  // suppression and cooldown checks on purpose: no point checking a site we won't email.
  let siteFindings = [];
  let siteCheckState = 'not used';
  if (siteCheck) {
    const sc = await siteCheck.get(siteHost(data.site_url || '', domain));
    if (sc.state === 'pending') {
      return {
        status: 'checking',
        subject: '',
        body: '',
        confidence: null,
        variant: null,
        reason: 'Checking their site for SEO and AI-search problems. This takes 10 to 40 seconds.',
        retryAfterSeconds: 5,
        contactEmail,
      };
    }
    if (sc.state === 'ready') {
      siteFindings = toOpenerFindings(sc.report);
      siteCheckState = sc.report.status === 'complete' ? 'used' : `used (${sc.report.status})`;
    } else {
      siteCheckState = `unavailable: ${sc.reason}`;
    }
  }

  const findings = [...(Array.isArray(data.findings) ? data.findings : []), ...siteFindings];
  const top = selectTopFinding(findings);
  if (!top) {
    touchHeartbeat('skipped_below_threshold');
    return { status: 'skipped_below_threshold', subject: '', body: '', confidence: null, variant: null, reason: 'No finding scored high enough to justify an email.', contactEmail, siteCheck: siteCheckState };
  }

  // A site-check title is already a plain sentence written for the site owner; rephraseFinding
  // is for the audit's messages and would strip the useful bracket off e.g. "No structured data
  // (schema markup)".
  const fromSiteCheck = top.finding.source === 'sitecheck';
  const findingMessage = fromSiteCheck
    ? `${top.finding.message}${top.finding.evidence ? ` (what our check saw: ${top.finding.evidence})` : ''}`
    : rephraseFinding(top.finding.message);
  const leadsWith = { source: fromSiteCheck ? 'site check' : 'audit', title: fromSiteCheck ? top.finding.message : findingMessage };
  const variant = nextVariant();

  // Not every finding's .url is a real page — customer_web_check's broken_link check in
  // particular can leave it as a non-URL placeholder like "(crawl)" when it doesn't have a
  // clean source-page attribution for that specific link (confirmed live 2026-09-14: this
  // was silently getting passed to the AI as if it were a real page to cite). Guard against
  // anything that doesn't actually look like a URL rather than trusting the field blindly.
  const findingUrl = /^https?:\/\//i.test(top.finding.url || '') ? top.finding.url : null;

  let draft;
  try {
    draft = await draftProspectEmail({
      businessName: label,
      niche: data.platform,
      findingMessage,
      findingDetail: fromSiteCheck ? top.finding.detail : '',
      findingUrl,
      proofLine: selectProofLine(data.vertical),
      variant,
    });
  } catch (err) {
    appendDraftLog({ run, slug, domain, status: 'error', variant, error: err.message });
    touchHeartbeat('error');
    throw err;
  }

  // A site-check finding's title is short and generic by design ("AI assistants may not be able
  // to read your site"), so a good subject often uses the words from its explanation instead
  // ("your site blocks ChatGPT and Claude"). Compare against both, or that subject is wrongly
  // rejected as generic (seen live 2026-10-12).
  const subjectContext = fromSiteCheck ? `${findingMessage} ${top.finding.detail || ''}` : findingMessage;
  const record = {
    subject: draft.subject,
    body: draft.body,
    confidence: draft.confidence,
    variant,
    subjectContext,
    leadsWith,
    siteCheck: siteCheckState,
    generatedAt: new Date().toISOString(),
  };
  const reasons = gateReasons(record);
  const status = reasons.length ? 'auto_rejected' : 'pending';

  appendDraftLog({
    run,
    slug,
    domain,
    status,
    variant,
    confidence: draft.confidence,
    findingCategory: top.finding.category,
    findingId: top.finding.id,
    findingScore: top.score,
    siteCheck: siteCheckState,
    reasons: reasons.length ? reasons : undefined,
  });
  touchHeartbeat(status);
  if (draft.subject && draft.body) saveDraft(run, slug, record);

  return draftResponse(record, contactEmail, { saved: false });
}

// ---- the send queue: every email ready to go, across all runs --------------------------------
//
// One page to clear the outreach backlog: every prospect we could email today with its draft
// already written, so sending is Send/Skip rather than click, wait for the model, edit, send. The
// drafts are written beforehand by predraftAll() (cron script or the dashboard's "Draft the rest").

// A skip takes a prospect out of the queue without suppressing the business: it is "not this
// one, not now", where an opt-out is "never". Keyed by run and prospect like the sent log, so
// the same business turning up in a later batch is shown again.
function readSkips() {
  return readJsonSafe(SKIPS_FILE, {});
}

function getSkip(run, slug) {
  return readSkips()[`${run}:${slug}`] || null;
}

function setSkipped(run, slug, skipped = true) {
  const all = readSkips();
  const key = `${run}:${slug}`;
  if (skipped) all[key] = { skippedAt: new Date().toISOString(), siteDomain: siteDomainFor(run, slug) };
  else delete all[key];
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SKIPS_FILE, JSON.stringify(all, null, 2));
  return all[key] || null;
}

// What the last pre-draft pass got for prospects it could not write a draft for (no finding
// worth an email, an error), so the queue can say why and the next pass doesn't keep re-trying a
// prospect that has nothing to say.
function readPredraftState() {
  return readJsonSafe(PREDRAFT_STATE_FILE, {});
}

function writePredraftState(patch) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PREDRAFT_STATE_FILE, JSON.stringify({ ...readPredraftState(), ...patch }, null, 2));
  } catch (err) {
    console.error('prospects: could not save pre-draft state:', err.message);
  }
}

// Every prospect across all runs, newest run first, one per business website: a business that
// appears in several batches is judged on its row in the latest one (listRuns sorts by summary.csv
// mtime, newest first). Rows without a report (failed scans) are left out.
function latestProspectPerDomain() {
  const seen = new Set();
  const out = [];
  for (const { name: run } of listRuns()) {
    for (const row of getRunProspects(run) || []) {
      if (!row.slug) continue;
      const domain = getDomain(row.url) || `${run}:${row.slug}`;
      if (seen.has(domain)) continue;
      seen.add(domain);
      out.push({ run, row, domain });
    }
  }
  return out;
}

// Can this prospect get a first email today? The checks buildDraft makes before writing a draft,
// plus "sent already" and "skipped".
// -> 'ok' | 'no_email' | 'sent' | 'suppressed' | 'finished' | 'cooldown' | 'skipped'
function sendEligibility(run, row, domain, skips = readSkips()) {
  if (!row.contact_email) return 'no_email';
  if (row.sent) return 'sent';
  if (isSuppressed(domain, row.contact_email)) return 'suppressed';
  if (findFinishedSequenceForDomain(domain)) return 'finished';
  const recent = findRecentSendForDomain(domain);
  if (recent && daysSince(recent.sentAt) < config.prospectsCooldownDays) return 'cooldown';
  if (skips[`${run}:${row.slug}`]) return 'skipped';
  return 'ok';
}

function weeklyAllowance() {
  const sentLast7Days = countSentInLastDays(7);
  const limit = config.prospectsRateLimitPerWeek;
  return { sentLast7Days, limit, remaining: Math.max(0, limit - sentLast7Days) };
}

const ELIGIBILITY_COUNT_KEY = { no_email: 'noEmail' };

// items: drafts ready to send (status 'pending') and drafts the gates flagged ('auto_rejected',
// with the reason, to fix and send). The body is exactly what the draft route returns: AI body,
// guarantee, signature. Never calls the model.
function buildQueue() {
  const skips = readSkips();
  const predraftState = readPredraftState();
  const counts = {
    ready: 0, flagged: 0, missingDraft: 0, noFinding: 0, noEmail: 0,
    sent: 0, suppressed: 0, cooldown: 0, finished: 0, skipped: 0,
  };
  const items = [];
  for (const { run, row, domain } of latestProspectPerDomain()) {
    const eligibility = sendEligibility(run, row, domain, skips);
    if (eligibility !== 'ok') {
      counts[ELIGIBILITY_COUNT_KEY[eligibility] || eligibility] += 1;
      continue;
    }
    const saved = getSavedDraft(run, row.slug);
    if (!saved) {
      const last = predraftState[`${run}:${row.slug}`];
      if (last && last.status === 'skipped_below_threshold') counts.noFinding += 1;
      else counts.missingDraft += 1;
      continue;
    }
    const d = draftResponse(saved, row.contact_email);
    if (d.status === 'pending') counts.ready += 1; else counts.flagged += 1;
    items.push({
      run,
      slug: row.slug,
      label: (row.business_name && row.business_name.trim()) || cleanSiteUrl(row.url),
      domain,
      siteUrl: row.url,
      score: row.score,
      to: row.contact_email,
      subject: d.subject,
      body: d.body,
      status: d.status,
      flagged: d.status !== 'pending',
      reason: d.reason,
      lowConfidence: d.lowConfidence,
      confidence: d.confidence,
      variant: d.variant || null,
      leadsWith: d.leadsWith,
      generatedAt: d.generatedAt,
    });
  }
  // Ready ones first; within each group the runs' own worst-first order is kept (stable sort).
  items.sort((a, b) => Number(a.flagged) - Number(b.flagged));
  return { items, counts, weekly: weeklyAllowance(), predraft: predraftStatus() };
}

// For a first email sent from the queue: the "can we email them" checks again at send time, so a
// double click or a stale page can't send twice. null = fine. (Skips don't block: pressing Send
// on a card is a decision to send.)
const SEND_BLOCK_REASON = {
  sent: 'This prospect has already been emailed.',
  suppressed: 'This domain or address is on the suppression list.',
  finished: "Two emails already went to this business with no reply. We don't email them again.",
  cooldown: 'This business was emailed within the cooldown window.',
};
function firstEmailBlockReason(run, slug) {
  const row = findSummaryRow(run, slug);
  if (!row) return null;
  const state = sendEligibility(run, { ...row, contact_email: row.contact_email || '-' }, getDomain(row.url), {});
  return SEND_BLOCK_REASON[state] || null;
}

// ---- pre-drafting ----------------------------------------------------------------------------

// One pre-draft at a time, across processes: the cron script and the dashboard's button both take
// this lock. The holder touches it after every prospect, so a lock nobody has touched for
// PREDRAFT_LOCK_STALE_MS belongs to a run that died and is taken over.
const PREDRAFT_LOCK_STALE_MS = 10 * 60 * 1000;
let predraftProgress = null; // this process's run in progress: { startedAt, done, total }
let lastPredraftResult = null;

function acquirePredraftLock() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    if (Date.now() - fs.statSync(PREDRAFT_LOCK_FILE).mtimeMs > PREDRAFT_LOCK_STALE_MS) fs.unlinkSync(PREDRAFT_LOCK_FILE);
  } catch { /* no lock file */ }
  try {
    fs.writeFileSync(PREDRAFT_LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

function touchPredraftLock() {
  try { const t = new Date(); fs.utimesSync(PREDRAFT_LOCK_FILE, t, t); } catch { /* best effort */ }
}

function releasePredraftLock() {
  try { fs.unlinkSync(PREDRAFT_LOCK_FILE); } catch { /* already gone */ }
}

function predraftLockHeld() {
  try {
    return Date.now() - fs.statSync(PREDRAFT_LOCK_FILE).mtimeMs <= PREDRAFT_LOCK_STALE_MS;
  } catch {
    return false;
  }
}

// `running` is true for a run in this process or another (the cron script); progress is only
// known for this process's own run.
function predraftStatus() {
  return {
    running: !!predraftProgress || predraftLockHeld(),
    progress: predraftProgress ? { ...predraftProgress } : null,
    last: lastPredraftResult,
  };
}

// The prospects predraftAll would draft: emailable today and no saved draft yet. One whose last
// attempt found nothing worth an email is left alone unless `retryNoFinding` is set.
function predraftCandidates({ retryNoFinding = false } = {}) {
  const skips = readSkips();
  const state = readPredraftState();
  return latestProspectPerDomain()
    .filter(({ run, row, domain }) => sendEligibility(run, row, domain, skips) === 'ok')
    .filter(({ run, row }) => !getSavedDraft(run, row.slug))
    .filter(({ run, row }) => retryNoFinding || (state[`${run}:${row.slug}`] || {}).status !== 'skipped_below_threshold')
    .map(({ run, row, domain }) => ({ run, slug: row.slug, domain }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Writes a draft for every prospect in predraftCandidates(), one at a time (the model sits behind
// one proxy). Each goes through buildDraft, so the same gates apply and the draft is saved. One
// whose site check is still running ('checking') is skipped and tried again after the rest, up to
// checkRounds more times, retryWaitMs apart; any still checking after that are reported as such
// and picked up by the next run. One prospect failing never stops the run.
// -> summary, or { started: false, reason } when another run holds the lock.
async function predraftAll({ checkRounds = 12, retryWaitMs = 5000, retryNoFinding = false } = {}) {
  if (predraftProgress || !acquirePredraftLock()) return { started: false, reason: 'A pre-draft run is already in progress.' };
  const startedAt = new Date().toISOString();
  const summary = {
    started: true, startedAt, finishedAt: null, candidates: 0,
    drafted: 0, flagged: 0, noFinding: 0, checking: 0, errors: 0, other: 0, results: [],
  };
  try {
    let todo = predraftCandidates({ retryNoFinding });
    summary.candidates = todo.length;
    predraftProgress = { startedAt, done: 0, total: todo.length };
    for (let round = 0; todo.length && round <= checkRounds; round += 1) {
      if (round > 0) await sleep(retryWaitMs);
      const stillChecking = [];
      for (const p of todo) {
        let outcome;
        try {
          const d = await buildDraft(p.run, p.slug);
          outcome = d ? { status: d.status, reason: d.reason || null } : { status: 'missing', reason: 'Prospect report not found.' };
        } catch (err) {
          outcome = { status: 'error', reason: err.message };
        }
        touchPredraftLock();
        if (outcome.status === 'checking') { stillChecking.push(p); continue; }
        predraftProgress.done += 1;
        summary.results.push({ run: p.run, slug: p.slug, domain: p.domain, ...outcome });
        writePredraftState({ [`${p.run}:${p.slug}`]: { status: outcome.status, reason: outcome.reason, at: new Date().toISOString() } });
      }
      todo = stillChecking;
    }
    for (const p of todo) {
      summary.results.push({ run: p.run, slug: p.slug, domain: p.domain, status: 'checking', reason: 'Site check still running; the next run picks it up.' });
    }
    for (const r of summary.results) {
      if (r.status === 'pending') summary.drafted += 1;
      else if (r.status === 'auto_rejected') summary.flagged += 1;
      else if (r.status === 'skipped_below_threshold') summary.noFinding += 1;
      else if (r.status === 'checking') summary.checking += 1;
      else if (r.status === 'error') summary.errors += 1;
      else summary.other += 1;
    }
    summary.finishedAt = new Date().toISOString();
    return summary;
  } finally {
    lastPredraftResult = { ...summary, results: undefined };
    predraftProgress = null;
    releasePredraftLock();
  }
}

module.exports = {
  isValidName,
  listRuns,
  getRunProspects,
  prospectExists,
  buildDraft,
  markSent,
  getSentRecord,
  siteDomainFor,
  markReplied,
  optOut,
  normalizeAddress,
  findSentByAddress,
  applyInboundReply,
  appendInboundReplyLog,
  addBusinessDays,
  followUpState,
  buildFollowUp,
  markFollowUpSent,
  listFollowUps,
  outreachStats,
  cleanSiteUrl,
  rephraseFinding,
  isConcreteSubject,
  gateReasons,
  getSavedDraft,
  selectTopFinding,
  findingScore,
  setSiteCheck,
  siteHost,
  selectProofLine,
  getDomain,
  isSuppressed,
  countSentInLastDays,
  buildQueue,
  getSkip,
  setSkipped,
  firstEmailBlockReason,
  predraftCandidates,
  predraftAll,
  predraftStatus,
};
