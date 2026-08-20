#!/usr/bin/env node
/**
 * Drafts a client-facing update note from real commits in a client's repo
 * since the last run, using AIOS to turn commit messages into plain
 * language. Draft-only: emails the proposed note for review, never posts
 * it — posting is `node scripts/client-status.js note <token> "..."`, run
 * by hand once approved.
 *
 * Currently only wired for Darren / website-lawyer — Craig / Trade Price
 * Shutters has no git repo to draft from yet (see automation session notes,
 * 2026-08-19).
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const AIOS_URL = process.env.AIOS_URL || 'http://localhost:8010';
const AIOS_MODEL = process.env.AIOS_MODEL || 'anthropic/claude-sonnet-5';

const CLIENTS = [
  { token: 'geymo8cnyasc', name: 'Darren', repo: '/opt/docker/website-lawyer' },
];

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

async function draftNote(clientName, commitSubjects) {
  const systemPrompt = `You draft short client-facing project update notes for a web development studio. Given a list of raw git commit messages (technical, written for developers), write ONE short note (2-4 sentences, plain English, no jargon, no commit-speak) summarizing what was actually done from the client's perspective. Do not mention "commits", "git", or file names. Do not invent anything not implied by the commit messages. If the commits are too vague/technical to say anything meaningful, say so instead of guessing. Output ONLY the note text, no preamble, no quotes around it.`;

  const userContent = `Client: ${clientName}\n\nRecent commit messages:\n${commitSubjects.map((s) => `- ${s}`).join('\n')}`;

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

async function sendReviewEmail(client, note, commitSubjects) {
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = [
    `<h2>Draft client update — ${escape(client.name)}</h2>`,
    `<p><strong>Proposed note:</strong></p>`,
    `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#333;">${escape(note)}</blockquote>`,
    `<p>Based on these recent commits:</p>`,
    `<ul>${commitSubjects.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`,
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
  for (const client of CLIENTS) {
    if (!fs.existsSync(path.join(client.repo, '.git'))) {
      console.log(`[${client.name}] no git repo at ${client.repo}, skipping`);
      continue;
    }

    const stateFile = lastCommitFile(client.token);
    const lastHash = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8').trim() : null;
    const headHash = getHeadHash(client.repo);

    if (lastHash === headHash) {
      console.log(`[${client.name}] no new commits since last check`);
      continue;
    }

    const commits = getNewCommits(client.repo, lastHash);
    if (commits.length === 0) {
      console.log(`[${client.name}] only autosync/merge commits since last check, nothing worth drafting`);
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, headHash);
      continue;
    }

    console.log(`[${client.name}] ${commits.length} substantive commit(s) since last check, drafting note`);
    const note = await draftNote(client.name, commits);
    await sendReviewEmail(client, note, commits);
    console.log(`[${client.name}] draft emailed for review`);

    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, headHash);
  }
}

main().catch((err) => {
  console.error('auto-client-update failed:', err);
  process.exit(1);
});
