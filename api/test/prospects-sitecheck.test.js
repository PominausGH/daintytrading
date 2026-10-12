'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createProspectSiteCheck, toOpenerFindings } = require('../lib/prospects-sitecheck');
const { selectTopFinding, findingScore, siteHost } = require('../lib/prospects-store');
const { createService } = require('../lib/sitecheck');
const config = require('../lib/config');

const REPORT = {
  domain: 'acme.com.au', status: 'complete', outcome: 'setup_scale', platform: 'WordPress',
  counts: { high: 0, medium: 2, low: 1 },
  findings: [
    { id: 'no_structured_data', group: 'findability', severity: 'medium', title: 'No structured data (schema markup)', detail: 'Schema markup tells search engines...', evidence: '' },
    { id: 'ai_crawlers_blocked', group: 'findability', severity: 'medium', title: 'AI assistants are blocked from reading your site', detail: 'Your robots.txt...', evidence: 'GPTBot, ClaudeBot' },
    { id: 'no_llms_txt', group: 'findability', severity: 'low', title: 'No llms.txt file', detail: '...', evidence: '' },
    { id: 'no_analytics', group: 'measurement', severity: 'medium', title: 'No analytics on the site', detail: '...', evidence: 'None found' },
  ],
  good: [], notTested: [], notes: [],
};
const brokenLink = { category: 'broken_link', severity: 'medium', message: 'Broken/unreachable link: https://acme.com.au/old' };
const tick = () => new Promise((r) => setTimeout(r, 5));

// ---- report -> findings the draft can lead with ------------------------------------------------

test('toOpenerFindings keeps id, group, severity and the plain-English title', () => {
  const out = toOpenerFindings(REPORT);
  assert.equal(out.length, 4);
  assert.deepEqual(
    { source: out[1].source, id: out[1].id, category: out[1].category, severity: out[1].severity, message: out[1].message, evidence: out[1].evidence },
    { source: 'sitecheck', id: 'ai_crawlers_blocked', category: 'sitecheck_findability', severity: 'medium', message: 'AI assistants are blocked from reading your site', evidence: 'GPTBot, ClaudeBot' },
  );
  assert.deepEqual(toOpenerFindings(null), []);
  assert.deepEqual(toOpenerFindings({ findings: [null, {}, { id: 'x' }] }), []);
});

test('an SEO/GEO finding from the site check outranks a broken link from the audit', () => {
  const top = selectTopFinding([brokenLink, ...toOpenerFindings(REPORT)]);
  assert.equal(top.finding.id, 'ai_crawlers_blocked');
  assert.ok(top.score > findingScore(brokenLink));
});

test('low-severity and measurement findings never lead; without anything stronger the broken link still does', () => {
  const weak = toOpenerFindings({ findings: REPORT.findings.filter((f) => f.id === 'no_llms_txt' || f.id === 'no_analytics') });
  assert.equal(selectTopFinding(weak), null);
  assert.equal(selectTopFinding([brokenLink, ...weak]).finding.category, 'broken_link');
});

test('a high-severity security finding (end-of-life software) can lead, a medium one cannot', () => {
  const eol = toOpenerFindings({ findings: [{ id: 'eol_software', group: 'security', severity: 'high', title: 'The site appears to run software that is no longer supported', detail: '', evidence: 'PHP 5.6' }] });
  assert.equal(selectTopFinding(eol).finding.id, 'eol_software');
  const mixed = toOpenerFindings({ findings: [{ id: 'mixed_content', group: 'security', severity: 'medium', title: 'Some content loads insecurely', detail: '', evidence: '' }] });
  assert.equal(selectTopFinding(mixed), null);
});

test('siteHost keeps the address as audited and falls back when it cannot be parsed', () => {
  assert.equal(siteHost('https://www.Acme.com.au/about', 'acme.com.au'), 'www.acme.com.au');
  assert.equal(siteHost('acme.com.au', 'x'), 'acme.com.au');
  assert.equal(siteHost('', 'acme.com.au'), 'acme.com.au');
});

test('there is a proof line for law firms and it does not name the client', () => {
  const line = config.prospectsProofLines.legal_services;
  assert.match(line, /law firm/);
  assert.doesNotMatch(line, /Edwards|Kirby/i);
});

// ---- pending / ready / unavailable ------------------------------------------------------------

test('a fresh check answers pending straight away, then ready once the report is in', async () => {
  let release;
  const calls = [];
  const sc = createProspectSiteCheck({
    checkDomain: (host) => { calls.push(host); return new Promise((r) => { release = () => r(REPORT); }); },
    waitMs: 5,
  });
  assert.deepEqual(await sc.get('acme.com.au'), { state: 'pending' });
  assert.deepEqual(await sc.get('acme.com.au'), { state: 'pending' });
  assert.deepEqual(calls, ['acme.com.au'], 'asking again must not start a second check');
  release();
  await tick();
  const ready = await sc.get('acme.com.au');
  assert.equal(ready.state, 'ready');
  assert.equal(ready.report.findings.length, 4);
  assert.deepEqual(calls, ['acme.com.au']);
});

test('a cached report is ready on the first ask', async () => {
  const sc = createProspectSiteCheck({ checkDomain: async () => REPORT, waitMs: 50 });
  assert.equal((await sc.get('acme.com.au')).state, 'ready');
});

test('a failed check is unavailable with the reason, and the next ask tries again', async () => {
  let n = 0;
  const sc = createProspectSiteCheck({
    checkDomain: async () => { n += 1; if (n === 1) throw new Error('The checker is temporarily unavailable.'); return REPORT; },
    waitMs: 50,
  });
  assert.deepEqual(await sc.get('acme.com.au'), { state: 'unavailable', reason: 'The checker is temporarily unavailable.' });
  assert.equal((await sc.get('acme.com.au')).state, 'ready');
  assert.equal((await sc.get('')).state, 'unavailable');
});

// ---- checkOnly on the real service ------------------------------------------------------------

test('checkOnly returns a report with no code, email or lead, and reuses the 24h cache', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitecheck-only-'));
  const emails = [];
  const checkerCalls = [];
  const svc = createService({
    sendEmail: async (m) => { emails.push(m); return { success: true }; },
    fetchImpl: async (url, init) => {
      checkerCalls.push(JSON.parse(init.body).domain);
      return { status: 200, ok: true, json: async () => ({ ...REPORT, domain: JSON.parse(init.body).domain }) };
    },
    dataDir,
    log: { error() {}, warn() {}, log() {} },
  });
  const first = await svc.checkOnly('https://WWW.Acme.com.au/contact');
  assert.equal(first.domain, 'www.acme.com.au');
  const second = await svc.checkOnly('www.acme.com.au');
  assert.equal(second.findings.length, 4);
  assert.deepEqual(checkerCalls, ['www.acme.com.au'], 'second call is served from the cache');
  assert.equal(emails.length, 0);
  assert.ok(!fs.existsSync(path.join(dataDir, 'sitecheck-leads.jsonl')));
  assert.equal(svc._state.jobs.size, 0);
  await assert.rejects(() => svc.checkOnly('localhost'), /public internet|valid website/);
});
