'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { isConcreteSubject } = require('../lib/prospects-store');
const config = require('../lib/config');

// The first live site-check draft (2026-10-12): a good subject, rejected as generic because it
// shared no word with the finding's short title.
const TITLE = 'AI assistants may not be able to read your site';
const DETAIL = "When AI crawlers are blocked, tools like ChatGPT, Claude and Perplexity can't learn what you do, so they can't recommend you.";
const SUBJECT = 'your site blocks ChatGPT and Claude from seeing it at all';

test('a subject using the words of the finding explanation counts as concrete', () => {
  assert.equal(isConcreteSubject(SUBJECT, TITLE), false, 'the title alone is what used to reject it');
  assert.equal(isConcreteSubject(SUBJECT, `${TITLE} ${DETAIL}`), true);
});

test('a generic subject is still rejected, with or without the explanation', () => {
  assert.equal(isConcreteSubject('Quick question about your website', `${TITLE} ${DETAIL}`), false);
  assert.equal(isConcreteSubject('Noticed something', `${TITLE} ${DETAIL}`), false);
  assert.equal(isConcreteSubject('', TITLE), false);
  assert.equal(isConcreteSubject('x'.repeat(121), TITLE), false);
});

test('gate defaults: confidence 0.6, body up to 100 words', () => {
  assert.equal(config.prospectsConfidenceThreshold, 0.6);
  assert.equal(config.prospectsMaxWords, 100);
});

test('the model is asked for fewer words than the gate allows, so a small overshoot still passes', () => {
  const { PROMPT_WORD_TARGET, SYSTEM_PROMPT } = require('../lib/prospects-aios');
  assert.equal(PROMPT_WORD_TARGET, config.prospectsMaxWords - 20);
  assert.ok(SYSTEM_PROMPT.includes(`${PROMPT_WORD_TARGET} words maximum for the body`));
  assert.ok(!SYSTEM_PROMPT.includes(`${config.prospectsMaxWords} words maximum`));
});
