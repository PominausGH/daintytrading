'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The store reads its directories at load time, and node --test runs each file in its own
// process, so point it at scratch dirs and stub the model before requiring it.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prospects-saved-'));
process.env.PROSPECTS_REPORTS_DIR = path.join(root, 'reports');
process.env.DATA_DIR = path.join(root, 'data');

const modelCalls = [];
let nextDraft = { subject: 'broken link on your shutters page', body: 'Hi Acme,\n\nOne of your links is broken.', confidence: 0.8 };
const aiosPath = require.resolve('../lib/prospects-aios');
require.cache[aiosPath] = {
  id: aiosPath, filename: aiosPath, loaded: true,
  exports: { draftProspectEmail: async (args) => { modelCalls.push(args); return { ...nextDraft }; } },
};

const store = require('../lib/prospects-store');
const config = require('../lib/config');

const RUN = 'run-1';
const runDir = path.join(process.env.PROSPECTS_REPORTS_DIR, RUN);
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'summary.csv'),
  'url,business_name,contact_email,platform,score,findings_count,high_severity_count,status,error_message,report_path,pdf_path,json_path\n' +
  `https://acme.com.au/,Acme Shutters,info@acme.com.au,wordpress,60,1,0,ok,,,,${path.join(runDir, 'acme-com-au.json')}\n`);
fs.writeFileSync(path.join(runDir, 'acme-com-au.json'), JSON.stringify({
  site_url: 'https://acme.com.au/', platform: 'wordpress', contact_email: 'info@acme.com.au',
  findings: [{ category: 'broken_link', severity: 'medium', message: 'Broken/unreachable link: https://acme.com.au/shutters/old', url: 'https://acme.com.au/shutters' }],
}));
const SLUG = 'acme-com-au';

test('the first open writes a draft with one model call and saves it', async () => {
  const d = await store.buildDraft(RUN, SLUG);
  assert.equal(d.status, 'pending');
  assert.equal(d.saved, false);
  assert.equal(d.subject, 'broken link on your shutters page');
  assert.ok(d.body.endsWith(config.prospectsSignature));
  assert.equal(modelCalls.length, 1);
  const file = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'prospects-drafts.json'), 'utf8'));
  assert.equal(file[`${RUN}:${SLUG}`].body, 'Hi Acme,\n\nOne of your links is broken.', 'stored without the signature');
});

test('opening it again returns the same draft and does not call the model', async () => {
  nextDraft = { subject: 'a different link subject', body: 'Different body about a broken link.', confidence: 0.9 };
  const again = await store.buildDraft(RUN, SLUG);
  assert.equal(again.saved, true);
  assert.equal(again.subject, 'broken link on your shutters page');
  assert.ok(again.generatedAt);
  assert.equal(again.leadsWith.source, 'audit');
  assert.equal(modelCalls.length, 1);
});

test('Regenerate (fresh) calls the model once more and replaces the saved draft', async () => {
  const fresh = await store.buildDraft(RUN, SLUG, { fresh: true });
  assert.equal(fresh.saved, false);
  assert.equal(fresh.subject, 'a different link subject');
  assert.equal(modelCalls.length, 2);
  const reopened = await store.buildDraft(RUN, SLUG);
  assert.equal(reopened.subject, 'a different link subject');
  assert.equal(modelCalls.length, 2);
});

test('a saved draft is judged against the current gates, not the ones it was written under', async () => {
  nextDraft = { subject: 'broken link on your site', body: 'Short body about the broken link.', confidence: 0.65 };
  const d = await store.buildDraft(RUN, SLUG, { fresh: true });
  assert.equal(d.status, 'pending', '0.65 clears the 0.6 gate');
  const original = config.prospectsConfidenceThreshold;
  config.prospectsConfidenceThreshold = 0.7;
  try {
    const stricter = await store.buildDraft(RUN, SLUG);
    assert.equal(stricter.saved, true);
    assert.equal(stricter.status, 'auto_rejected');
    assert.match(stricter.reason, /confidence 0.65 below 0.7/);
  } finally {
    config.prospectsConfidenceThreshold = original;
  }
  assert.equal(modelCalls.length, 3, 'no model call for the re-judged saved draft');
});

test('an unknown prospect is still null and never calls the model', async () => {
  assert.equal(await store.buildDraft(RUN, 'nobody'), null);
  assert.equal(modelCalls.length, 3);
});
