function required(name, fallback) {
  return process.env[name] || fallback;
}

const config = {
  aiosUrl: required('AIOS_URL', 'http://aios-aios-1:8000'),
  aiosModel: required('AIOS_MODEL', 'anthropic/claude-sonnet-5'),

  // Cold-outreach drafting gates — see lib/prospects-store.js.
  prospectsConfidenceThreshold: parseFloat(required('PROSPECTS_CONFIDENCE_THRESHOLD', '0.7')),
  prospectsMinFindingScore: parseFloat(required('PROSPECTS_MIN_FINDING_SCORE', '0.5')),
  prospectsCooldownDays: parseInt(required('PROSPECTS_COOLDOWN_DAYS', '90'), 10),
  prospectsRateLimitPerWeek: parseInt(required('PROSPECTS_RATE_LIMIT_PER_WEEK', '25'), 10),
  prospectsMaxWords: parseInt(required('PROSPECTS_MAX_WORDS', '90'), 10),

  // Andrew's own case-study line, referenced in the drafted email as social proof. Override
  // per batch/niche via env if a different proof point fits better.
  shuttersmithProofLine: required(
    'PROSPECTS_PROOF_LINE',
    'We rebuilt Shuttersmith\'s site the same way, one fix at a time, no downtime.'
  ),

  // Spam Act 2003 requires accurate sender-contact info the recipient can use for at least 30
  // days — a working email address satisfies this (ACMA guidance), a street address isn't
  // required. Defaults to the same FROM_EMAIL identity lib/email.js already sends from, so
  // this doesn't need its own separately-configured value.
  prospectsFooterAddress: required(
    'PROSPECTS_FOOTER_ADDRESS',
    `Dainty Trading · ABN 65 366 917 788 · ${required('FROM_EMAIL', 'hello@daintytrading.com')}`
  ),
};

module.exports = config;
