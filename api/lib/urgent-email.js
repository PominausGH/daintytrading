'use strict';
// Emails to hello@telaloom.com reach /api/inbound-reply via the reply-router worker. A subject that
// starts with URGENT (as /support.html tells clients to write it) becomes a push. Replies in the
// same thread ("Re: URGENT ...") don't, so a back-and-forth doesn't re-page.
const { sendPush } = require('./pushover');
const support = require('./support-alerts');

const isUrgentSubject = (subject) => /^\s*urgent\b/i.test(String(subject || ''));

async function handleUrgentEmail({ from, subject, text, autoSubmitted }, deps = {}) {
  if (!isUrgentSubject(subject)) return { sent: false, reason: 'not_urgent' };
  if (autoSubmitted && !/^no$/i.test(autoSubmitted)) return { sent: false, reason: 'auto_submitted' };
  const clients = deps.clients || support.loadClients();
  const client = support.findClientBySender(from, clients);
  const priority = support.priorityFor(client, deps.now || new Date());
  const who = client ? `${client.name} (${client.care ? 'Care' : 'no Care'}${client.plan ? ` + ${client.plan}` : ''})` : `unknown sender ${from}`;
  const snippet = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const result = await (deps.sendPush || sendPush)({
    title: `URGENT email: ${client ? client.name : from}`,
    message: `${who}\n${String(subject).slice(0, 200)}\n\n${snippet}`,
    priority,
    url: 'https://mail.google.com/mail/u/0/#search/subject%3Aurgent',
    urlTitle: 'Open in Gmail',
  });
  console.log(`[urgent-email] @${String(from).split('@')[1] || '?'} client=${client ? 'yes' : 'no'} p${priority} sent=${result.ok}`);
  return { sent: !!result.ok, priority };
}

module.exports = { handleUrgentEmail, isUrgentSubject };
