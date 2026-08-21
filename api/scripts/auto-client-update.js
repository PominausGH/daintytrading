#!/usr/bin/env node
/**
 * Drafts a client-facing update note from real commits in a client's repo
 * since the last run, using AIOS to turn commit messages into plain
 * language. Draft-only: emails the proposed note for review, never posts
 * it — posting is `node scripts/client-status.js note <token> "..."`, run
 * by hand once approved.
 *
 * Draws on two sources, either of which may be empty:
 *   1. new commits in a repo we hold for the client;
 *   2. audit findings CLOSED since the last note, from the site-audit
 *      rotation's findings.json.
 *
 * Source 2 is what makes SEO/GEO retainers reportable: that work lands on
 * someone else's hosting, so there are no commits and the audit trail is the
 * only record it happened. Only *fixed* findings are drafted from — see
 * getFixedFindings() for why open ones are withheld.
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
 * SEO/GEO work usually lands as changes to someone else's site, so there are
 * no commits to draft from — the audit trail is the only record that it
 * happened. Returns the findings CLOSED since `since`, plus the current open
 * count.
 *
 * Deliberately returns only FIXED findings for the note. Open findings name
 * live weaknesses on the client's site (missing headers, stale plugin
 * versions, reachable paths); "here is what is still wrong with you" is not
 * something to draft into a client-facing update, and definitely not
 * something to have an LLM paraphrase unsupervised. openCount is a bare
 * number, included in the review email for Andrew's context only — it is not
 * given to the drafter.
 */
function getFixedFindings(auditDomain, since) {
  const file = path.join(AUDITS_DIR, auditDomain, 'findings.json');
  if (!auditDomain || !fs.existsSync(file)) return { fixed: [], openCount: null };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.log(`[${auditDomain}] findings.json unreadable (${err.message}) — treating as no findings`);
    return { fixed: [], openCount: null };
  }

  const findings = Array.isArray(parsed) ? parsed : parsed.findings || [];
  const fixed = findings
    .filter((f) => f.status === 'fixed' && f.fixedDate && (!since || f.fixedDate > since))
    .map((f) => f.title || f.id)
    .filter(Boolean);
  const openCount = findings.filter((f) => f.status === 'open').length;
  return { fixed, openCount };
}

async function draftNote(clientName, commitSubjects, fixedFindings) {
  const systemPrompt = `You draft short client-facing project update notes for a web development studio. You are given two kinds of raw input, either of which may be empty: git commit messages (technical, written for developers), and titles of website issues that have now been FIXED (written for a technical audit report). Write ONE short note (2-4 sentences, plain English, no jargon, no commit-speak) summarizing what was actually done from the client's perspective.

Rules:
- Do not mention "commits", "git", file names, or "audit findings".
- Do not invent anything not implied by the input. If the input is too vague to say anything meaningful, say so instead of guessing.
- Describe fixed issues as improvements in plain outcome terms (e.g. "your site now loads correctly for Google's crawler"). Never name a specific vulnerability, software version, plugin, server technology, or file path — this note goes to a non-technical business owner and may be forwarded onward.
- Never imply work is finished or ongoing beyond what the input shows.
Output ONLY the note text, no preamble, no quotes around it.`;

  const parts = [`Client: ${clientName}`];
  if (commitSubjects.length) {
    parts.push(`Recent commit messages:\n${commitSubjects.map((s) => `- ${s}`).join('\n')}`);
  }
  if (fixedFindings.length) {
    parts.push(`Website issues resolved since the last update:\n${fixedFindings.map((s) => `- ${s}`).join('\n')}`);
  }
  const userContent = parts.join('\n\n');

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

async function sendReviewEmail(client, note, commitSubjects, fixedFindings, openCount) {
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = [
    `<h2>Draft client update — ${escape(client.name)}</h2>`,
    `<p><strong>Proposed note:</strong></p>`,
    `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#333;">${escape(note)}</blockquote>`,
    commitSubjects.length
      ? `<p>Based on these recent commits:</p><ul>${commitSubjects.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`
      : '',
    fixedFindings.length
      ? `<p>And these audit findings resolved since the last update:</p><ul>${fixedFindings.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`
      : '',
    openCount !== null
      ? `<p style="color:#666;font-size:12px;">${openCount} finding(s) still open on ${escape(client.auditDomain || '')} — deliberately not given to the drafter and not in the note. Read the report on the server.</p>`
      : '',
    `<p>To post it as-is:</p>`,
    `<pre style="background:#f5f5f5;padding:10px;">node scripts/client-status.js note ${client.token} "${escape(note).replace(/"/g, '\\"')}"</pre>`,
    `<p style="color:#666;font-size:12px;">Not posted automatically — this is a draft for review.</p>`,
  ].join('\n');

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
    const { fixed, openCount } = getFixedFindings(client.auditDomain, lastNoteDate);

    if (commits.length === 0 && fixed.length === 0) {
      console.log(`[${client.name}] nothing substantive since last check (no commits, no findings closed)`);
      // Still advance the commit pointer past autosync-only churn, so those
      // commits aren't re-examined every run.
      if (hasRepo && headHash) {
        fs.mkdirSync(path.dirname(stateFile), { recursive: true });
        fs.writeFileSync(stateFile, headHash);
      }
      continue;
    }

    console.log(
      `[${client.name}] ${commits.length} commit(s) + ${fixed.length} finding(s) closed since last check, drafting note`
    );
    const note = await draftNote(client.name, commits, fixed);
    await sendReviewEmail(client, note, commits, fixed, openCount);
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
