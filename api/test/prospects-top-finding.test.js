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
