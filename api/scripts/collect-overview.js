#!/usr/bin/env node
/**
 * Builds the admin project overview by reading state that already exists.
 * Nothing here is typed in by hand — every field is derived, so the page can
 * never drift out of date the way a manually-maintained board does.
 *
 * Sources, all of them already self-updating:
 *   - Business table (Postgres)          which sites are ours
 *   - audits/clients.json                which sites are clients
 *   - audits/<domain>/findings.json      open/closed findings, owner split
 *   - audits/<domain>/latest.md          when it was last audited
 *   - audits/uptime-state.json           up/down, refreshed hourly
 *   - git log in each mapped repo        last code activity
 *   - api/data/clients/*.json            client checklist progress
 *   - secondbrain Postgres db            open todos captured via Telegram
 *
 * RUNS ON THE HOST, NOT IN THE CONTAINER. The API container has no mount for
 * /opt/docker/marketing-os/audits, and it must stay that way: those reports
 * name live weaknesses on client sites, and the API serves public traffic.
 * This script is the deliberate projection — it emits counts and dates, never
 * finding text — and writes to api/data, which the container does mount.
 *
 * Usage: node scripts/collect-overview.js [--stdout]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AUDITS_DIR = '/opt/docker/marketing-os/audits';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'project-overview.json');

// Domain -> repo, mirroring the site-fix skill's mapping. A domain missing
// here simply reports no code activity rather than guessing at a folder.
const REPOS = {
  'focusshield.app': '/opt/docker/focusguard',
  'app.focusshield.app': '/opt/docker/focusguard',
  'postreel.app': '/opt/docker/social-poster',
  'everyring.ai': '/opt/docker/everyring',
  'bizpage.biz': '/opt/docker/bizpage-builder',
  'siteready.uk': '/opt/docker/bizpage-builder',
  'daintytrading.com': '/opt/docker/dainty',
  'convoforge.app': '/opt/docker/convoforge',
  'cvmatcher.work': '/opt/docker/cv-matcher',
  'autoarchivemail.com': '/opt/docker/autoarchive',
  'email-triage.app': '/opt/docker/emailtriage',
  'brightpath.school': '/opt/docker/brightpath',
  'subscriptionincinerator.app': '/opt/docker/subscription',
  'timerforge.app': '/opt/docker/timerforge',
  'nudgle.app': '/opt/docker/skeddy',
  'voxtty.com': '/opt/docker/voxtty',
  'lawyer.subscriptionincinerator.app': '/opt/docker/website-lawyer',
};

// Domain -> sb_projects.name (secondbrain db). Names are freeform — captured
// from Telegram via an LLM, not typed to match this list — so this mapping
// needs a manual glance whenever a project gets renamed there. More than one
// name can point at a domain (e.g. duplicate captures of the same project).
const SECONDBRAIN_PROJECTS = {
  'focusshield.app': ['FocusShield'],
  'app.focusshield.app': ['FocusShield'],
  'postreel.app': ['Postreel'],
  'everyring.ai': ['Everyring.ai'],
  'bizpage.biz': ['Bizpage Project Update'],
  'siteready.uk': ['Bizpage Project Update'],
  'daintytrading.com': ['Dainty Trading'],
  'convoforge.app': ['Convo_Forge'],
  'cvmatcher.work': ['CV Enhancement'],
  'autoarchivemail.com': ['Auto Archive Email'],
  'email-triage.app': ['Automated Email Triage Project'],
  'brightpath.school': ['BrightPath', 'Bright Path Project'],
  'subscriptionincinerator.app': ['Subscription Incinerator App Review'],
  'timerforge.app': ['TimerForge'],
  'nudgle.app': ['Nudgle'],
  'voxtty.com': ['Voxtty'],
  'tradepriceshutters.com.au': ['Trade Price Shutters'],
  'www.eklawyers.com.au': ['EK Lawyers Website'],
  'signalreads.com': ['Ghostwriter Project'],
};

function safeJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function businessDomains() {
  try {
    const out = execSync(
      `docker exec postgres-main psql -U marketing_os -d marketing_os -t -A -c ` +
        `"SELECT DISTINCT regexp_replace(url, '^https?://([^/]+).*$', '\\1') FROM \\"Business\\" ORDER BY 1;"`,
      { encoding: 'utf8', timeout: 20000 }
    );
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    // Distinguish "no sites" from "couldn't ask" — the page says so rather
    // than rendering an empty board that looks like everything's gone.
    return null;
  }
}

function secondBrainTasksByProject() {
  try {
    // Ordered so the first task per project is the one worth surfacing:
    // highest priority, then oldest (been sitting longest).
    const out = execSync(
      `docker exec postgres-main psql -U postgres -d secondbrain -t -A -F $'\\x1f' -c ` +
        `"SELECT p.name, left(replace(t.task, chr(10), ' '), 140), t.priority ` +
        `FROM sb_tasks t JOIN sb_projects p ON p.id = t.project_id ` +
        `WHERE NOT t.completed ` +
        `ORDER BY p.name, CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.created_at;"`,
      { encoding: 'utf8', timeout: 20000, shell: '/bin/bash' }
    );
    const byProject = {};
    out.split('\n').forEach((line) => {
      if (!line.trim()) return;
      const [name, task, priority] = line.split('\x1f');
      if (!name) return;
      (byProject[name] = byProject[name] || []).push({ task, priority });
    });
    return byProject;
  } catch (e) {
    // Distinguishes "no open tasks" from "couldn't ask" the same way
    // businessDomains() does — null, not an empty object.
    return null;
  }
}

function secondBrainFor(domain, byProject) {
  const names = SECONDBRAIN_PROJECTS[domain];
  if (!names || !byProject) return null;
  const tasks = names.flatMap((n) => byProject[n] || []);
  if (!tasks.length) return { open: 0, top: null };
  return { open: tasks.length, top: tasks[0].task };
}

function findingsFor(domain) {
  const f = safeJson(path.join(AUDITS_DIR, domain, 'findings.json'), null);
  if (!f) return null;
  const list = Array.isArray(f) ? f : f.findings || [];
  const open = list.filter((x) => x.status === 'open');
  const bySeverity = {};
  open.forEach((x) => {
    const s = (x.severity || 'unknown').toLowerCase();
    bySeverity[s] = (bySeverity[s] || 0) + 1;
  });
  return {
    open: open.length,
    bySeverity,
    blockedOnClient: open.filter((x) => x.owner === 'client').length,
    // Unlabelled counts as ours — same conservative rule the drafter uses.
    ours: open.filter((x) => x.owner !== 'client').length,
    fixedTotal: list.filter((x) => x.status === 'fixed').length,
    // Longest-running unresolved issue: the thing most worth looking at.
    oldestOpenDate: open.map((x) => x.firstSeenDate).filter(Boolean).sort()[0] || null,
  };
}

function lastAudited(domain) {
  const f = path.join(AUDITS_DIR, domain, 'latest.md');
  try {
    return fs.statSync(f).mtime.toISOString().slice(0, 10);
  } catch (e) {
    return null;
  }
}

function codeActivity(domain) {
  const repo = REPOS[domain];
  if (!repo || !fs.existsSync(path.join(repo, '.git'))) return null;
  try {
    // Skip autosync commits: git-sync-all.sh commits nightly on every repo,
    // so the newest commit is almost always machine noise. Showing it would
    // make every project look actively worked on.
    const out = execSync(
      `git -C "${repo}" log --no-merges --format=%cI%x1f%s -n 40`,
      { encoding: 'utf8', timeout: 15000 }
    ).trim();
    const real = out
      .split('\n')
      .map((l) => l.split('\x1f'))
      .find(([, subject]) => subject && !subject.startsWith('autosync:'));
    if (!real) return { repo, lastCommit: null, subject: null };
    return { repo, lastCommit: real[0].slice(0, 10), subject: real[1].slice(0, 120) };
  } catch (e) {
    return { repo, lastCommit: null, subject: null };
  }
}

function checklistFor(domain, clientsByDomain) {
  const token = clientsByDomain[domain];
  if (!token) return null;
  const rec = safeJson(path.join(DATA_DIR, 'clients', `${token}.json`), null);
  if (!rec || !Array.isArray(rec.actions)) return null;
  return {
    token,
    outstanding: rec.actions.filter((a) => !a.verifiedFixed && !a.claimedDone).length,
    awaitingConfirmation: rec.actions.filter((a) => !a.verifiedFixed && a.claimedDone).length,
    confirmed: rec.actions.filter((a) => a.verifiedFixed).length,
  };
}

function main() {
  const uptime = safeJson(path.join(AUDITS_DIR, 'uptime-state.json'), {});
  const clients = safeJson(path.join(AUDITS_DIR, 'clients.json'), []);
  const clientByDomain = {};
  clients.forEach((c) => { clientByDomain[c.domain] = c; });

  // Portal token per audit domain, kept in step with the drafter.
  const PORTAL = {
    'www.eklawyers.com.au': 'geymo8cnyasc',
    'tradepriceshutters.com.au': 'gkrkdzenl94u',
  };

  const own = businessDomains();
  const dbReachable = own !== null;
  const secondBrainTasks = secondBrainTasksByProject();
  const secondBrainReachable = secondBrainTasks !== null;
  const domains = Array.from(new Set([...(own || []), ...clients.map((c) => c.domain)])).sort();

  const projects = domains.map((domain) => {
    const client = clientByDomain[domain];
    const up = uptime[domain];
    return {
      domain,
      kind: client ? 'client' : 'own',
      client: client ? client.client : null,
      authorised: client ? Boolean(client.authorised_by && !/^TODO/.test(client.authorised_by)) : null,
      site: up ? { status: up.status || null, lastChecked: up.lastChecked || null } : null,
      lastAudited: lastAudited(domain),
      findings: findingsFor(domain),
      code: codeActivity(domain),
      checklist: checklistFor(domain, PORTAL),
      secondbrain: secondBrainFor(domain, secondBrainTasks),
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    dbReachable,
    secondBrainReachable,
    counts: {
      total: projects.length,
      clients: projects.filter((p) => p.kind === 'client').length,
      neverAudited: projects.filter((p) => !p.lastAudited).length,
      blockedOnClient: projects.reduce((n, p) => n + (p.findings ? p.findings.blockedOnClient : 0), 0),
      secondBrainOpen: projects.reduce((n, p) => n + (p.secondbrain ? p.secondbrain.open : 0), 0),
    },
    projects,
  };

  if (process.argv.includes('--stdout')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`wrote ${OUT_FILE} — ${projects.length} projects, db=${dbReachable ? 'ok' : 'UNREACHABLE'}, secondbrain=${secondBrainReachable ? 'ok' : 'UNREACHABLE'}`);
}

main();
