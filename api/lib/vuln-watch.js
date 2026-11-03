'use strict';
// Monthly known-vulnerability watch for Monitor / Growth / Scale clients (the "Patch Watch" line
// in the Monitor tier). Runs the same passive checker the public Site Check uses against each
// client domain, keeps only the vulnerable-software findings, and emails ONE summary to the
// operator. It never contacts clients itself: a human decides what to tell whom.
//
// A summary goes out every run, including all-clear, so silence can never mean "job is broken".
// Clients come from DATA_DIR/support-clients.json (see lib/support-alerts.js for the shape).
const fs = require('fs');
const path = require('path');
const { escapeHtml } = require('./security');

const WATCH_PLANS = new Set(['monitor', 'growth', 'scale']);
const WATCH_IDS = new Set(['known_vuln', 'eol_software']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hostOf(url) {
  try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase(); } catch (_e) { return null; }
}

// [{ client, plan, domains[] }] for every client on a watched plan with at least one domain.
function watchTargets(clients) {
  return clients
    .filter((c) => WATCH_PLANS.has(String(c.plan || '').toLowerCase()))
    .map((c) => {
      const hosts = [
        ...(c.domains || []).map(hostOf),
        ...(c.sites || []).map((s) => hostOf(typeof s === 'string' ? s : s && s.url)),
      ].filter(Boolean);
      return { client: c.name || '(unnamed)', plan: String(c.plan).toLowerCase(), domains: [...new Set(hosts)] };
    })
    .filter((t) => t.domains.length);
}

async function checkDomain(domain, { fetchImpl, checkerUrl, timeoutMs }) {
  try {
    const res = await fetchImpl(`${checkerUrl}/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || !Array.isArray(body.findings)) return { domain, error: `checker returned ${res.status}` };
    return { domain, findings: body.findings.filter((f) => WATCH_IDS.has(f.id)).map((f) => ({ id: f.id, title: f.title, evidence: f.evidence })) };
  } catch (err) {
    return { domain, error: err.message };
  }
}

function renderSummary(month, results) {
  const flagged = results.filter((r) => r.findings && r.findings.length);
  const failed = results.filter((r) => r.error);
  const clean = results.length - flagged.length - failed.length;
  const row = (r) => `<li><strong>${escapeHtml(r.client)}</strong> (${escapeHtml(r.plan)}) - ${escapeHtml(r.domain)}`
    + (r.error ? `: <em>check failed: ${escapeHtml(r.error)}</em>` : `<ul>${r.findings.map((f) => `<li>${escapeHtml(f.title)} - ${escapeHtml(f.evidence)}</li>`).join('')}</ul>`) + '</li>';
  const subject = flagged.length
    ? `Patch Watch ${month}: ${flagged.length} site(s) need attention`
    : failed.length ? `Patch Watch ${month}: all clear, ${failed.length} check(s) failed` : `Patch Watch ${month}: all clear`;
  const html = `<p>Monthly known-vulnerability watch, ${results.length} domain(s) checked: ${flagged.length} flagged, ${clean} clear, ${failed.length} failed.</p>`
    + (flagged.length ? `<h3>Needs attention</h3><ul>${flagged.map(row).join('')}</ul>` : '')
    + (failed.length ? `<h3>Could not check</h3><ul>${failed.map(row).join('')}</ul>` : '')
    + '<p>Passive check of publicly visible versions only (PHP header, CMS generator). A match means "appears to run an affected version"; hosts can hide or backport versions, so confirm with the client or host before telling them it is confirmed. Nothing has been sent to clients.</p>';
  return { subject, html };
}

async function runWatch(deps = {}) {
  const {
    clients,
    fetchImpl = fetch,
    checkerUrl = process.env.SITECHECK_URL || 'http://site-checker:8000',
    sendEmail,
    notifyEmail = process.env.CONTACT_NOTIFICATION_EMAIL || 'hello@daintytrading.com',
    dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
    now = new Date(),
    delayMs = 5000,
    timeoutMs = 60000,
    dryRun = false,
    only = null,
    log = console,
  } = deps;

  let targets = watchTargets(clients);
  if (only) targets = targets.map((t) => ({ ...t, domains: t.domains.filter((d) => d === only) })).filter((t) => t.domains.length);

  const results = [];
  for (const t of targets) {
    for (const domain of t.domains) {
      if (results.length) await sleep(delayMs); // stay gentle: one site at a time
      results.push({ client: t.client, plan: t.plan, ...(await checkDomain(domain, { fetchImpl, checkerUrl, timeoutMs })) });
    }
  }

  const month = now.toISOString().slice(0, 7);
  const summary = renderSummary(month, results);
  if (dryRun) {
    log.log(`[vuln-watch] dry run: ${summary.subject}`);
    for (const r of results) log.log(`  ${r.client} / ${r.domain}: ${r.error ? `ERROR ${r.error}` : `${r.findings.length} finding(s)`}`);
    return { month, results, summary, sent: false };
  }
  fs.mkdirSync(path.join(dataDir, 'vuln-watch'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'vuln-watch', `${month}.json`), JSON.stringify({ month, ranAt: now.toISOString(), results }, null, 2));
  await sendEmail({ to: notifyEmail, subject: summary.subject, html: summary.html });
  return { month, results, summary, sent: true };
}

module.exports = { runWatch, watchTargets, renderSummary, WATCH_IDS, WATCH_PLANS };
