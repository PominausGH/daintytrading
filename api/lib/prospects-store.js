const fs = require('fs');
const path = require('path');

// Read-only mount from customer-web_check's `reports/` dir (see docker-compose.yml).
// PROSPECTS_REPORTS_DIR lets local/dev runs point at a scratch fixture dir instead.
const REPORTS_ROOT = process.env.PROSPECTS_REPORTS_DIR || path.join(__dirname, '..', 'prospects-reports');
// Writable — same mount clients-store.js already uses for JSON/JSONL data.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SENT_LOG_FILE = path.join(DATA_DIR, 'prospects-sent.json');

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

function markSent(run, slug, { to, subject }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const log = readSentLog();
  const record = { sentAt: new Date().toISOString(), to, subject };
  log[`${run}:${slug}`] = record;
  fs.writeFileSync(SENT_LOG_FILE, JSON.stringify(log, null, 2));
  return record;
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
  // Drop a trailing " — aside" / " - aside" clause.
  text = text.replace(/\s+[—–-]\s+[^—–-]+$/, '');
  // Drop a trailing parenthetical.
  text = text.replace(/\s*\([^)]*\)\s*$/, '');
  // Drop a trailing bare URL (optionally backtick-wrapped, optionally after a colon).
  text = text.replace(/:?\s*`?https?:\/\/\S+`?\s*$/i, '');
  // Trim any leftover trailing colon/whitespace.
  text = text.replace(/[:\s]+$/, '');
  if (!text) return message.trim();
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildDraft(run, slug) {
  const data = readProspectJson(run, slug);
  if (!data) return null;

  const row = findSummaryRow(run, slug);
  const businessName =
    (row && row.business_name && row.business_name.trim()) ||
    (data.abr && data.abr.entity_name) ||
    null;
  const label = businessName || cleanSiteUrl(data.site_url);

  const findings = Array.isArray(data.findings) ? data.findings : [];
  const f1 = findings[0] ? rephraseFinding(findings[0].message) : '';
  const f2 = findings[1] ? rephraseFinding(findings[1].message) : '';

  let findingsSentence;
  if (f1 && f2) {
    findingsSentence = `Noticed a couple of things — ${f1} and ${f2}.`;
  } else if (f1) {
    findingsSentence = `Noticed one thing — ${f1}.`;
  } else {
    findingsSentence = "Had a look through and there's a bit of room for improvement.";
  }

  const subject = `Quick note about ${label}`;
  const body = [
    'Hi there,',
    '',
    `I run a small AU web dev studio and had a look at ${label}'s site. ${findingsSentence}`,
    '',
    "Nothing urgent, but easy wins. Happy to send over the full breakdown if useful, or if you'd like a hand fixing any of it, happy to help with that too. Just reply either way.",
    '',
    'Andrew',
    'Dainty Trading',
  ].join('\n');

  return { subject, body };
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
};
