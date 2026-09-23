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

  // Per-vertical case-study proof lines, referenced in the drafted email as social proof.
  // prospects-store.js's buildDraft() picks the entry matching the prospect's `vertical`
  // field (set by customer-web_check's sourcing pipeline — see sourcing/seed_queries.py),
  // falling back to `default` for manually-authored runs that don't set one. Add a new
  // vertical here once there's a real case study to back it (see seed_queries.py's
  // docstring for the current plan: lawyers, once that site is live). Each entry is
  // individually overridable via PROSPECTS_PROOF_LINE_<VERTICAL_UPPERCASE>.
  prospectsProofLines: {
    default: required(
      'PROSPECTS_PROOF_LINE',
      'We rebuilt Shuttersmith\'s site the same way, one fix at a time, no downtime.'
    ),
    shutters_blinds_awnings: required(
      'PROSPECTS_PROOF_LINE_SHUTTERS_BLINDS_AWNINGS',
      'We rebuilt two shutters and blinds businesses\' sites for the same client, one fix at a time, no downtime.'
    ),
  },

  // Sender identity for prospect outreach specifically — deliberately separate from
  // lib/email.js's global FROM_EMAIL/FROM_NAME (switched to TelaLoom 2026-09-23, used by every
  // other email flow: client updates, agreement e-sign notifications, etc.). daintytrading.com
  // now 301-redirects to telaloom.com (confirmed live 2026-09-20) and telaloom.com is
  // already Brevo-authenticated (verified via /v3/senders/domains, set up 2026-09-18) — so
  // outreach sends and signs as Telaloom instead of a domain that no longer resolves
  // directly. The app-wide FROM_EMAIL/FROM_NAME followed on 2026-09-23 (Andrew: "remove
  // daintytrading"); these stay separate so outreach identity can still diverge if needed —
  // see [[daintytrading-telaloom-rebrand-2026-09-18]].
  prospectsFromEmail: required('PROSPECTS_FROM_EMAIL', 'hello@telaloom.com'),
  prospectsFromName: required('PROSPECTS_FROM_NAME', 'Telaloom'),

  // Signature appended after the AI-drafted body (not counted against prospectsMaxWords —
  // it's fixed boilerplate, not part of the pitch). A cold email claiming a defect on the
  // recipient's own site, from an unsigned business name with no way to verify the sender,
  // reads as a phishing pattern regardless of wording — a real name + a real link the
  // recipient can check before trusting the claim fixes that. Uses a full https:// URL
  // (not a bare domain) so it round-trips cleanly through textToHtml's URL auto-linkifier.
  prospectsSignature: required(
    'PROSPECTS_SIGNATURE',
    'Andrew, Telaloom\nhttps://telaloom.com'
  ),

  // Spam Act 2003 requires accurate sender-contact info the recipient can use for at least 30
  // days — a working email address satisfies this (ACMA guidance), a street address isn't
  // required. Defaults to the same identity prospect emails now actually send from (see
  // prospectsFromEmail above), so this doesn't need its own separately-configured value.
  prospectsFooterAddress: required(
    'PROSPECTS_FOOTER_ADDRESS',
    `Telaloom · ABN 65 366 917 788 · ${required('PROSPECTS_FROM_EMAIL', 'hello@telaloom.com')}`
  ),
};

module.exports = config;
