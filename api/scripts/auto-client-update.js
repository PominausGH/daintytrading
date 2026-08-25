#!/usr/bin/env node
/**
 * Drafts client-facing updates from real evidence, using AIOS to turn
 * technical records into plain language. Draft-only: emails the proposals for
 * review, never posts them.
 *
 * Produces TWO separate drafts per client, deliberately never merged:
 *
 *   1. WORK COMPLETED  -> post as a timeline note (accumulates; it is a log)
 *      `client-status.js note <token> "..."`
 *      Sources: new commits in a repo we hold, plus findings closed since the
 *      last note.
 *
 *   2. REQUIRED TO COMPLETE -> set as the next milestone (replaces; it is a
 *      standing state, not an event)
 *      `client-status.js update <token> --next "..."`
 *      Source: open findings marked `"owner": "client"`.
 *
 * Blending the two is what makes a progress update feel evasive — it buries
 * what is still being waited on inside a list of achievements. They are also
 * posted by separate commands so either can be sent without the other.
 *
 * The findings sources are what make an SEO/GEO retainer reportable at all:
 * that work lands on someone else's hosting, so there are no commits and the
 * audit trail is the only record it happened.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const AIOS_URL = process.env.AIOS_URL || 'http://localhost:8010';
const AIOS_MODEL = process.env.AIOS_MODEL || 'anthropic/claude-sonnet-5';

// `repo` is optional: a client with no repo here (an SEO/GEO-only engagement
// on someone else's hosting) still has an audit trail to draft from.
// `auditDomain` is the key into /opt/docker/marketing-os/audits/<domain>/.
const CLIENTS = [
  {
    token: 'geymo8cnyasc',
    name: 'Darren',
    repo: '/opt/docker/website-lawyer',
    auditDomain: 'www.eklawyers.com.au',
  },
  {
    token: 'gkrkdzenl94u',
    name: 'Craig',
    // No git repo on this box, so there are no commits to draft from — the
    // audit findings delta is the whole input for this client.
    repo: null,
    auditDomain: 'tradepriceshutters.com.au',
  },
];

const AUDITS_DIR = '/opt/docker/marketing-os/audits';

function lastCommitFile(token) {
  return path.join(process.env.DATA_DIR, 'clients', `${token}.last-commit`);
}

function getNewCommits(repo, sinceHash) {
  const range = sinceHash ? `${sinceHash}..HEAD` : '-20'; // first run: last 20 commits, not full history
  const out = execSync(`git -C "${repo}" log --no-merges --format=%s ${range}`, { encoding: 'utf8' });
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('autosync:'));
}

function getHeadHash(repo) {
  return execSync(`git -C "${repo}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
}

function lastNoteDateFile(token) {
  return path.join(process.env.DATA_DIR, 'clients', `${token}.last-note-date`);
}

/**
 * Splits a domain's findings into the two client-facing halves, plus a count
 * of what is withheld.
 *
 * The split is by `owner`, which the site-audit skill sets per finding:
 *
 *   completed — closed since `since`, ours or theirs. A log, so date-filtered.
 *   needed    — open AND `owner: "client"`. A standing state, so NOT
 *               date-filtered: an item stays listed until they actually do it.
 *   withheld  — open and anything else. Never sent.
 *
 * Withholding open items we own is the important rule. They are our backlog,
 * and they frequently describe live weaknesses on the client's site (missing
 * headers, stale plugin versions, reachable paths) — not something to mail
 * out, and not something to have an LLM paraphrase unsupervised. A finding
 * with no `owner` at all falls in here too: unlabelled must err toward
 * withholding rather than over-disclosing, which also makes the field safe to
 * roll out gradually across existing findings.json files.
 */
function getFindings(auditDomain, since) {
  const empty = { completed: [], needed: [], withheldCount: 0 };
  const file = path.join(AUDITS_DIR, auditDomain, 'findings.json');
  if (!auditDomain || !fs.existsSync(file)) return empty;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.log(`[${auditDomain}] findings.json unreadable (${err.message}) — treating as no findings`);
    return empty;
  }

  const findings = Array.isArray(parsed) ? parsed : parsed.findings || [];
  const title = (f) => f.title || f.id;

  // Work completed: anything closed since the last note, ours or theirs.
  const completed = findings
    .filter((f) => f.status === 'fixed' && f.fixedDate && (!since || f.fixedDate > since))
    .map(title)
    .filter(Boolean);

  // Required to complete: open items only the client can action. Not
  // date-filtered — this is a current standing list, not a log, so an item
  // stays on it until they actually do it.
  const needed = findings
    .filter((f) => f.status === 'open' && f.owner === 'client')
    .map(title)
    .filter(Boolean);

  // Open items owned by us are never sent. They are our backlog, and they
  // often describe live weaknesses on the client's site. A finding with no
  // owner counts here too: missing means unlabelled, and unlabelled must
  // err toward withholding.
  const withheldCount = findings.filter((f) => f.status === 'open' && f.owner !== 'client').length;

  return { completed, needed, withheldCount };
}

// Shared voice rules. Modelled on the Shuttersmith report Craig actually got
// (deliverables/craig-report.md): plain English, no jargon, and the two halves
// kept strictly apart — "what we've already done" vs "what needs you".
const VOICE = `You write for a web development studio, addressing a non-technical business owner directly as "you". Plain English, no jargon, no commit-speak. Do not mention "commits", "git", file names, or "audit findings". Do not invent anything not implied by the input — if the input is too vague to say anything meaningful, say so instead of guessing. Never name a specific vulnerability, software version, plugin, server technology, or file path: this text may be forwarded onward.`;

/** Half one: work completed. Becomes a timeline note — a permanent log entry. */
async function draftCompleted(clientName, commitSubjects, completedFindings) {
  const systemPrompt = `${VOICE}

Write ONE short paragraph (2-4 sentences) headed by nothing, summarising WORK ALREADY COMPLETED since the last update, from the client's perspective. Describe fixed issues as improvements in plain outcome terms (e.g. "your site now loads correctly for Google's crawler"). Only describe what the input shows — never imply anything is still in progress or still to come; a separate message covers that. Output ONLY the paragraph, no preamble, no quotes around it.`;

  const parts = [`Client: ${clientName}`];
  if (commitSubjects.length) {
    parts.push(`Development work done:\n${commitSubjects.map((s) => `- ${s}`).join('\n')}`);
  }
  if (completedFindings.length) {
    parts.push(`Website issues resolved:\n${completedFindings.map((s) => `- ${s}`).join('\n')}`);
  }
  return aiosDraft(systemPrompt, parts.join('\n\n'));
}

/**
 * Half two: what is required to complete the work — and specifically the
 * things only the CLIENT can do. Becomes the portal's nextMilestone, which
 * replaces rather than accumulates, because this is a standing state ("still
 * waiting on you for X"), not a log of events.
 */
async function draftNeeded(clientName, neededFindings) {
  const systemPrompt = `${VOICE}

Write a SHORT list of what you still need FROM THE CLIENT to finish the work — only things the client themselves must do or decide, because you cannot do them for them. Lead with one short sentence, then one line per item, each naming the action plainly. Keep it to the items given; do not pad, and do not include anything you could do yourself. Output ONLY that text, no preamble, no quotes around it.`;

  const userContent = `Client: ${clientName}\n\nOutstanding items only the client can action:\n${neededFindings
    .map((s) => `- ${s}`)
    .join('\n')}`;
  return aiosDraft(systemPrompt, userContent);
}

async function aiosDraft(systemPrompt, userContent) {

  const res = await fetch(`${AIOS_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_name: 'dainty_client_update_drafter',
      query_type: 'llm',
      query_data: {
        llms: [{ name: AIOS_MODEL, backend: 'openai' }],
        messages: [
          { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
          { role: 'user', content: userContent },
        ],
        // claude-sonnet-5 via the litellm proxy only accepts temperature=1 (omit
        // rather than send 0); max_new_tokens raised past AIOS's 1000 default,
        // which otherwise lets reasoning consume the budget before any visible
        // content comes out — same gotchas documented in wave-invoicing-agent
        // and content-pipeline-agent's aiosClient.js.
        max_new_tokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`AIOS query failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const message = data?.response?.response_message;
  if (!message) {
    throw new Error(`AIOS returned no response_message: ${JSON.stringify(data)}`);
  }
  return message.trim();
}

/**
 * The two drafts are presented — and posted — separately, never merged into
 * one message. "Work completed" is a log entry and accumulates on the
 * timeline; "required to complete work" is a standing state and replaces the
 * previous one. Blending them produces the thing clients hate: a progress
 * update that quietly buries what is still being waited on.
 */
async function sendReviewEmail(client, drafts, sources) {
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const block = (s) =>
    `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#333;white-space:pre-wrap;">${escape(s)}</blockquote>`;

  const body = [
    `<h2>Draft client update — ${escape(client.name)}</h2>`,

    drafts.completed
      ? [
          `<h3>1. Work completed &mdash; post as a timeline note</h3>`,
          block(drafts.completed),
          sources.commits.length
            ? `<p style="font-size:13px;">From this development work:</p><ul style="font-size:13px;">${sources.commits.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`
            : '',
          sources.completed.length
            ? `<p style="font-size:13px;">And these issues resolved:</p><ul style="font-size:13px;">${sources.completed.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`
            : '',
        ].join('\n')
      : `<h3>1. Work completed</h3><p style="color:#666;">Nothing completed since the last update.</p>`,

    `<hr/>`,

    drafts.needed
      ? [
          `<h3>2. Required to complete the work &mdash; set as the next milestone</h3>`,
          block(drafts.needed),
          `<p style="font-size:13px;">From these open items only ${escape(client.name)} can action:</p><ul style="font-size:13px;">${sources.needed.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`,
        ].join('\n')
      : `<h3>2. Required to complete the work</h3><p style="color:#666;">Nothing currently outstanding on ${escape(client.name)}'s side.</p>`,

    sources.withheldCount
      ? `<hr/><p style="color:#666;font-size:12px;">${sources.withheldCount} open finding(s) on ${escape(client.auditDomain || '')} are ours to fix, or unlabelled. Withheld from both drafts by design — read the report on the server.</p>`
      : '',

    `<p style="color:#666;font-size:12px;">Neither is posted automatically — both are drafts for review. Post with: node scripts/client-status.js note ${escape(client.token)} '...' (work completed) or node scripts/client-status.js update ${escape(client.token)} --next '...' (required next).</p>`,
  ]
    .filter(Boolean)
    .join('\n');

  const apiKeyLine = fs
    .readFileSync('/opt/docker/dainty/api/.env', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('BREVO_API_KEY='));
  const brevoKey = apiKeyLine ? apiKeyLine.split('=').slice(1).join('=') : '';

  execSync(
    `BREVO_API_KEY='${brevoKey}' python3 /opt/docker/marketing-os/audits/send-daily-email.py "Draft client update ready — ${client.name}"`,
    { input: body, stdio: ['pipe', 'inherit', 'inherit'] }
  );
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);

  for (const client of CLIENTS) {
    const hasRepo = client.repo && fs.existsSync(path.join(client.repo, '.git'));
    if (client.repo && !hasRepo) {
      console.log(`[${client.name}] no git repo at ${client.repo}, code changes will not be included`);
    }

    // --- source 1: commits (only for clients whose code we hold) ---
    const stateFile = lastCommitFile(client.token);
    const lastHash = hasRepo && fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8').trim() : null;
    const headHash = hasRepo ? getHeadHash(client.repo) : null;
    let commits = [];
    if (hasRepo && lastHash !== headHash) {
      commits = getNewCommits(client.repo, lastHash);
    }

    // --- source 2: audit findings closed since the last note ---
    const noteDateFile = lastNoteDateFile(client.token);
    const lastNoteDate = fs.existsSync(noteDateFile)
      ? fs.readFileSync(noteDateFile, 'utf8').trim()
      : null;
    const { completed, needed, withheldCount } = getFindings(client.auditDomain, lastNoteDate);

    const hasCompleted = commits.length > 0 || completed.length > 0;
    if (!hasCompleted && needed.length === 0) {
      console.log(`[${client.name}] nothing to report (no work completed, nothing outstanding on their side)`);
      // Still advance the commit pointer past autosync-only churn, so those
      // commits aren't re-examined every run.
      if (hasRepo && headHash) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(stateFile, headHash);
      }
      continue;
    }

    console.log(
      `[${client.name}] ${commits.length} commit(s), ${completed.length} resolved, ${needed.length} awaiting them — drafting`
    );

    // Drafted independently so one can be empty without weakening the other:
    // a month of work with nothing outstanding still produces a completed
    // note, and a month blocked on the client still produces a clear ask.
    const drafts = {
      completed: hasCompleted ? await draftCompleted(client.name, commits, completed) : null,
      needed: needed.length ? await draftNeeded(client.name, needed) : null,
    };
    await sendReviewEmail(client, drafts, { commits, completed, needed, withheldCount });
    console.log(`[${client.name}] draft emailed for review`);

    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    if (hasRepo && headHash) fs.writeFileSync(stateFile, headHash);
    // Only advanced once a draft actually went out, so a failed run re-drafts
    // the same window next time instead of losing it.
    fs.writeFileSync(noteDateFile, today);
  }
}

main().catch((err) => {
  console.error('auto-client-update failed:', err);
  process.exit(1);
});
