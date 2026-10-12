'use strict';
/**
 * Site-check reports for prospect drafts.
 *
 * customer-web_check's audit (the prospect JSON) covers housekeeping: broken links, template
 * text, plugin age. It has no SEO/GEO checks, which is what we actually sell. Our own site
 * checker does, so a draft asks it about the prospect's site and lets those findings compete to
 * lead the email (lib/prospects-store.js).
 *
 * A fresh check takes 10 to 40 seconds and nginx cuts /api/ requests off at 10, so a draft
 * request never waits for one: get() starts the check and answers `pending`; the dashboard asks
 * again and gets `ready` once the report is in (and then from the 24h cache). The check itself
 * goes through the same service as the public checker, so it is passive and safefetch-only.
 */

const MAX_JOBS = 200;
const DONE_TTL_MS = 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createProspectSiteCheck({ checkDomain, waitMs = 1500, now = () => Date.now() } = {}) {
  const jobs = new Map(); // host -> { done, at, report?, error?, promise }

  function prune() {
    const ts = now();
    for (const [host, job] of jobs) if (job.done && ts - job.at > DONE_TTL_MS) jobs.delete(host);
  }

  // -> { state: 'ready', report } | { state: 'pending' } | { state: 'unavailable', reason }
  async function get(host) {
    if (!host || typeof host !== 'string') return { state: 'unavailable', reason: 'no site address' };
    prune();
    let job = jobs.get(host);
    if (!job) {
      if (jobs.size >= MAX_JOBS) return { state: 'unavailable', reason: 'too many checks in progress' };
      job = { done: false, at: now() };
      job.promise = Promise.resolve()
        .then(() => checkDomain(host))
        .then((report) => { job.report = report; }, (err) => { job.error = err; })
        .then(() => { job.done = true; job.at = now(); });
      jobs.set(host, job);
    }
    if (!job.done) await Promise.race([job.promise, sleep(waitMs)]);
    if (!job.done) return { state: 'pending' };
    if (job.error || !job.report || !Array.isArray(job.report.findings)) {
      // Forget a failure so the next click tries again instead of replaying it for an hour.
      jobs.delete(host);
      return { state: 'unavailable', reason: (job.error && job.error.message) || 'the checker returned no report' };
    }
    return { state: 'ready', report: job.report };
  }

  return { get, _jobs: jobs };
}

// Reshapes a checker report's findings into the shape prospects-store ranks. `message` is what
// the drafting model is told to write about; evidence is text taken from the prospect's own site,
// already stripped of control characters and capped at 200 characters by the checker.
function toOpenerFindings(report) {
  if (!report || !Array.isArray(report.findings)) return [];
  return report.findings
    .filter((f) => f && typeof f.id === 'string' && typeof f.title === 'string')
    .map((f) => ({
      source: 'sitecheck',
      id: f.id,
      group: f.group,
      category: `sitecheck_${f.group}`,
      severity: f.severity,
      message: f.title,
      detail: typeof f.detail === 'string' ? f.detail : '',
      evidence: typeof f.evidence === 'string' ? f.evidence : '',
    }));
}

module.exports = { createProspectSiteCheck, toOpenerFindings };
