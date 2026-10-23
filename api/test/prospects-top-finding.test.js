'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { selectTopFinding } = require('../lib/prospects-store');

const claim = { category: 'accc_claims', severity: 'high', message: 'Claim "Australian Made" found with no nearby substantiation' };
const brokenLink = { category: 'broken_link', severity: 'medium', message: 'Broken/unreachable link: https://example.com.au/old' };
const ogImage = { category: 'social_meta', severity: 'medium', message: 'Missing og:image' };

test('a claim finding never leads the email, even when it is the only high-severity finding', () => {
  const top = selectTopFinding([claim, claim, claim, ogImage]);
  assert.equal(top.finding.category, 'social_meta');
});

test('the usual ranking still applies to everything else', () => {
  assert.equal(selectTopFinding([ogImage, brokenLink]).finding.category, 'broken_link');
});

test('a site whose only medium-or-worse findings are claims gets no draft', () => {
  assert.equal(selectTopFinding([claim, claim]), null);
  assert.equal(selectTopFinding([claim, { category: 'page_bloat', severity: 'low', message: 'x' }]), null);
});

test('empty or malformed findings give no draft', () => {
  assert.equal(selectTopFinding([]), null);
  assert.equal(selectTopFinding(undefined), null);
  assert.equal(selectTopFinding([null, {}]), null);
});

test('customer-web_check PR #10 categories: search-blocking and noindex lead, low schema never does', () => {
  const f = (category, severity) => ({ category, severity, message: category });
  const brokenLink = f('broken_link', 'medium');
  assert.equal(selectTopFinding([brokenLink, f('crawler_access', 'high')]).finding.category, 'crawler_access');
  assert.equal(selectTopFinding([brokenLink, f('indexability', 'critical')]).finding.category, 'indexability');
  assert.ok(selectTopFinding([f('nap', 'medium')]), 'no phone on the homepage can lead');
  assert.ok(selectTopFinding([f('mobile_speed', 'medium')]), 'PSI-measured slow mobile can lead');
  assert.equal(selectTopFinding([f('local_schema', 'low')]), null, 'low severity never leads');
});
