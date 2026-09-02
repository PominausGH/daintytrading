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

  // Spam Act 2003 requires a genuine contact address in every commercial electronic message.
  // Deliberately no fallback here — sending without one would be non-compliant, so an unset
  // value is surfaced as a startup warning (see server.js) rather than silently defaulting.
  prospectsFooterAddress: process.env.PROSPECTS_FOOTER_ADDRESS || '',
};

module.exports = config;
