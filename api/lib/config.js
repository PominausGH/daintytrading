function required(name, fallback) {
  return process.env[name] || fallback;
}

// Like required(), but a variable set to an empty string stays empty (= "turn this off").
function optional(name, fallback) {
  return process.env[name] !== undefined ? process.env[name] : fallback;
}

const config = {
  aiosUrl: required('AIOS_URL', 'http://aios-aios-1:8000'),
  aiosModel: required('AIOS_MODEL', 'anthropic/claude-sonnet-5'),

  // Cold-outreach drafting gates — see lib/prospects-store.js.
  // Below this, the dashboard labels a draft's confidence "(low)". It no longer rejects the draft
  // (2026-10-13): confidence is the drafting model's own guess and the same prospect scored 0.58
  // to 0.74 across nine live drafts, so no cut-off separates good drafts from weak ones. A
  // person reviews every draft before it is sent.
  prospectsConfidenceThreshold: parseFloat(required('PROSPECTS_CONFIDENCE_THRESHOLD', '0.6')),
  prospectsMinFindingScore: parseFloat(required('PROSPECTS_MIN_FINDING_SCORE', '0.5')),
  prospectsCooldownDays: parseInt(required('PROSPECTS_COOLDOWN_DAYS', '90'), 10),
  prospectsRateLimitPerWeek: parseInt(required('PROSPECTS_RATE_LIMIT_PER_WEEK', '50'), 10),
  // The one follow-up becomes available this many working days after the first email, and only
  // if they haven't replied or opted out. There is no third email.
  prospectsFollowUpBusinessDays: parseInt(required('PROSPECTS_FOLLOW_UP_BUSINESS_DAYS', '5'), 10),
  // The gate: a body over this many words is auto-rejected. The drafting prompt asks the model
  // for 20 fewer (PROMPT_WORD_TARGET in lib/prospects-aios.js), because the model runs a few
  // words over whatever limit it is given.
  prospectsMaxWords: parseInt(required('PROSPECTS_MAX_WORDS', '100'), 10),

  // Per-vertical case-study proof lines, referenced in the drafted email as social proof.
  // prospects-store.js's buildDraft() picks the entry matching the prospect's `vertical`
  // field (set by customer-web_check's sourcing pipeline — see sourcing/seed_queries.py),
  // falling back to `default` for manually-authored runs that don't set one. Add a new
  // vertical here once there's a real case study to back it (see seed_queries.py's
  // docstring). Each entry is
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
    // The Sydney insolvency law firm case study (src/content/projects/edwards-kirby-lawyers.md).
    // The client is not named publicly, so neither is it here, and the line claims only the work
    // done, not results: the case study's status is still "about to go live".
    legal_services: required(
      'PROSPECTS_PROOF_LINE_LEGAL_SERVICES',
      'We rebuilt a Sydney law firm\'s website and built a secure client portal to go with it.'
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
  // Shared secret the Cloudflare Email Worker sends as `Authorization: Bearer <secret>` when it
  // forwards a prospect's reply to POST /api/inbound-reply. Empty/unset = the route answers 503.
  inboundReplySecret: optional('INBOUND_REPLY_SECRET', '').trim(),

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

  // The guarantee, appended between the AI-drafted body and the signature (and in the follow-up).
  // Like the signature it is fixed text, so it is added after the gates and not counted against
  // prospectsMaxWords. Set PROSPECTS_GUARANTEE_LINE to an empty string to leave it out: `optional`
  // keeps an empty value, where `required` would fall back to the default.
  prospectsGuaranteeLine: optional(
    'PROSPECTS_GUARANTEE_LINE',
    'Our promise: we fix every issue in the audit, then re-test until your mobile speed score is 70+ and Google and AI search tools can read your business details correctly. Until both pass, we keep working at no extra cost.'
  ).trim(),

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
