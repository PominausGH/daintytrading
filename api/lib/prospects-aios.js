const config = require('./config');

function stripCodeFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

// Same fix as content-pipeline-agent/lib/aiosClient.js: the model reliably writes multi-line
// "body" content as real prose with literal newlines instead of \n escapes — valid English,
// invalid JSON. Walks the string tracking whether we're inside a JSON string literal
// (respecting \" escapes) and escapes raw control characters found there.
function sanitizeJsonControlChars(text) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inString) {
      if (ch === '"') inString = true;
      result += ch;
      continue;
    }
    if (escaped) {
      result += ch;
      escaped = false;
    } else if (ch === '\\') {
      result += ch;
      escaped = true;
    } else if (ch === '"') {
      result += ch;
      inString = false;
    } else if (ch === '\n') {
      result += '\\n';
    } else if (ch === '\r') {
      result += '\\r';
    } else if (ch === '\t') {
      result += '\\t';
    } else if (ch.charCodeAt(0) < 0x20) {
      result += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    } else {
      result += ch;
    }
  }
  return result;
}

function parseModelJson(message) {
  const stripped = stripCodeFence(message);
  try {
    return JSON.parse(stripped);
  } catch (err) {
    return JSON.parse(sanitizeJsonControlChars(stripped));
  }
}

const SYSTEM_PROMPT = `You write short technical emails to Australian tradies and small business owners on behalf of a one-person web dev studio (Dainty Trading). No marketing language, no "I hope this finds you well", no adjectives. Australian spelling. ${config.prospectsMaxWords} words maximum for the body.

Structure the body as exactly four short lines/paragraphs, in this order:
1. What's broken — one line, concrete, naming the actual defect.
2. What it costs them — one line, the real business consequence (lost sales, lost trust, wasted ad spend), not a vague "this hurts SEO".
3. The fix you'd ship — one line, specific, not "we can help improve this".
4. The proof line given to you, verbatim or lightly adapted to flow — then a single ask: "want the full audit" (never "want a call" or "book a time").

The subject line must name the defect concretely (e.g. "your site tells ChatGPT the wrong thing about your quotes"), never something generic like "quick question" or "noticed something".

Output ONLY valid JSON, no markdown fence, matching this exact shape:
{"subject": "...", "body": "...", "confidence": 0.0}

"confidence" is your own honest 0-1 estimate of how likely this specific email is to land well with this specific business — not a fixed number.`;

async function callOnce(userContent) {
  const res = await fetch(`${config.aiosUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_name: 'dainty_prospect_email_drafter',
      query_type: 'llm',
      query_data: {
        llms: [{ name: config.aiosModel, backend: 'openai' }],
        messages: [
          { role: 'system', content: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }] },
          { role: 'user', content: userContent },
        ],
        // AIOS's 1000-token default lets Claude's reasoning consume the whole budget before
        // any visible content comes out — same gotcha documented in every other AIOS caller
        // on this host (content-pipeline-agent, wave-invoicing-agent). temperature is omitted
        // on purpose: claude-sonnet-5 via this litellm proxy only accepts temperature=1.
        max_new_tokens: 4096,
      },
    }),
    // A hung AIOS call must not block the admin dashboard's draft request forever.
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`AIOS query failed (${res.status}): ${body}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const message = data && data.response && data.response.response_message;
  if (!message) {
    throw new Error(`AIOS returned no response_message: ${JSON.stringify(data)}`);
  }

  const parsed = parseModelJson(message);
  return {
    subject: typeof parsed.subject === 'string' ? parsed.subject.trim() : '',
    body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  };
}

async function draftProspectEmail({ businessName, niche, findingMessage, proofLine, variant }) {
  const variantBrief =
    variant === 'B'
      ? 'Variant B: open with the cost line before the defect line — lead with what it\'s costing them, then name the defect.'
      : 'Variant A: open with the defect line first, in the standard order given above.';

  const userContent = [
    `Business: ${businessName}`,
    `Niche/platform: ${niche || 'unknown'}`,
    `Finding to write about: ${findingMessage}`,
    `Proof line to use: ${proofLine}`,
    variantBrief,
  ].join('\n');

  // One retry only, and never on a 4xx (bad payload/token — retrying won't fix it). This
  // repo's known AIOS failure modes (raw-newlines-in-JSON, transient 5xx/timeout) are both
  // one-shot glitches that a second attempt usually clears — see content-pipeline-agent's
  // lib/aiosClient.js, which added the same retry after shipping without one.
  try {
    return await callOnce(userContent);
  } catch (err) {
    if (err.status && err.status >= 400 && err.status < 500) throw err;
    return await callOnce(userContent);
  }
}

module.exports = { draftProspectEmail };
