var currentRun = null;
var currentProspects = [];
var currentSlug = null;
// The email window does two jobs: the first email ('draft') and the one follow-up ('followup').
// modalTarget is the prospect it is open for, which for a follow-up opened from the panel at the
// top may be in a different run from the one on screen.
var modalMode = 'draft';
var modalTarget = null;
var sendLocked = false;

function openModal(backdropId) {
  document.getElementById(backdropId).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(backdropId) {
  document.getElementById(backdropId).classList.remove('open');
  if (!document.querySelector('.modal-backdrop.open')) {
    document.body.style.overflow = '';
  }
}

document.querySelectorAll('.modal-backdrop').forEach(function (backdrop) {
  // Click directly on the dimmed backdrop (not its content) closes it — same convention
  // as the close (x) button, so there are two obvious ways out and no dead-end popup.
  backdrop.addEventListener('click', function (e) {
    if (e.target === backdrop) closeModal(backdrop.id);
  });
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(function (backdrop) {
      closeModal(backdrop.id);
    });
  }
});

document.getElementById('error-close').addEventListener('click', function () {
  closeModal('error-backdrop');
});
document.getElementById('draft-close').addEventListener('click', function () {
  closeModal('draft-backdrop');
});

function statusPillHtml(row) {
  var cls = row.status === 'error' ? 'status-pill error' : 'status-pill';
  return '<span class="' + cls + '">' + adminEscapeHtml(row.status || 'unknown') + '</span>';
}

// adminEscapeHtml() (via textContent/innerHTML) is only guaranteed to escape &, <, > — not
// necessarily ", so a URL containing a literal quote could otherwise break out of a
// double-quoted href attribute. Belt-and-braces for attribute-context embedding.
function attrEscape(str) {
  return adminEscapeHtml(str).replace(/"/g, '&quot;');
}

function shortDate(iso) {
  return iso ? String(iso).slice(0, 10) : '';
}

// What a sent row shows: where the two-email sequence is up to, and the two things only a person
// can record (they replied, or they asked not to be emailed).
function sentCellHtml(row, idx) {
  var state = row.followUpState;
  var html = '<span class="sent-pill">Sent</span>';
  if (state === 'replied') html += '<span class="seq-pill replied">Replied</span>';
  else if (state === 'opted_out') html += '<span class="seq-pill optout">Opted out</span>';
  else if (state === 'done') html += '<span class="seq-note">Follow-up sent ' + adminEscapeHtml(shortDate(row.followUpSentAt)) + '. No more emails.</span>';
  else if (state === 'due') html += ' <button type="button" class="btn btn-ghost row-followup-btn" data-idx="' + idx + '">Follow-up due →</button>';
  else if (state === 'not_due') html += '<span class="seq-note">Follow-up due ' + adminEscapeHtml(shortDate(row.followUpDueAt)) + '</span>';
  var actions = '';
  if (state === 'replied') actions += '<button type="button" class="seq-link row-unreply-btn" data-idx="' + idx + '">Undo replied</button>';
  else if (state !== 'opted_out') actions += '<button type="button" class="seq-link row-replied-btn" data-idx="' + idx + '">They replied</button>';
  if (state !== 'opted_out') actions += '<button type="button" class="seq-link row-optout-btn" data-idx="' + idx + '">Opt out</button>';
  return html + (actions ? '<span class="seq-actions">' + actions + '</span>' : '');
}

function renderProspects(prospects) {
  currentProspects = prospects;
  var table = document.getElementById('prospect-table');
  var body = document.getElementById('prospect-table-body');
  var empty = document.getElementById('empty-state');

  if (!prospects.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';

  body.innerHTML = prospects.map(function (row, idx) {
    var label = row.business_name && row.business_name.trim() ? row.business_name : row.url;
    // Flagging this up front (rather than only after a click) is the difference between
    // "clicking did nothing" and "there's genuinely no email captured for this one" —
    // status=error rows already say so via the status pill, no need to repeat it here.
    var noEmailTag = !row.contact_email && row.status !== 'error' ? ' <span class="no-email-tag">no email found</span>' : '';
    var urlLink = row.url
      ? '<a class="url row-url-link" href="' + attrEscape(row.url) + '" target="_blank" rel="noopener noreferrer">' + adminEscapeHtml(row.url) + '</a>'
      : '';
    return '<tr data-idx="' + idx + '">' +
      '<td><div class="biz">' + adminEscapeHtml(label) + '</div>' + urlLink + noEmailTag + '</td>' +
      '<td>' + (row.score == null ? '—' : adminEscapeHtml(String(row.score))) + '</td>' +
      '<td>' + (row.findings_count == null ? '—' : adminEscapeHtml(String(row.findings_count))) + '</td>' +
      '<td>' + (row.high_severity_count == null ? '—' : adminEscapeHtml(String(row.high_severity_count))) + '</td>' +
      '<td>' + statusPillHtml(row) + '</td>' +
      '<td>' + (row.sent
        ? sentCellHtml(row, idx)
        : '<button type="button" class="btn btn-ghost row-action-btn" data-idx="' + idx + '">Draft email →</button>') +
      '</td>' +
      '</tr>';
  }).join('');

  // Whole row stays clickable (convenience), but the explicit button is the primary,
  // visually-obvious way in — nothing about a plain table row signalled "click me" before
  // this, just a cursor change and a faint hover tint once you were already hovering.
  body.querySelectorAll('tr').forEach(function (tr) {
    tr.addEventListener('click', function () {
      var idx = parseInt(tr.dataset.idx, 10);
      selectProspect(idx);
    });
  });
  body.querySelectorAll('.row-url-link').forEach(function (link) {
    // Without this, clicking straight through to the business's own site would also
    // trigger the row's click handler underneath it and pop the draft modal open.
    link.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  });
  body.querySelectorAll('.row-action-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      selectProspect(parseInt(btn.dataset.idx, 10));
    });
  });
  function onRowButton(selector, handler) {
    body.querySelectorAll(selector).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var row = currentProspects[parseInt(btn.dataset.idx, 10)];
        if (row) handler(row, parseInt(btn.dataset.idx, 10));
      });
    });
  }
  onRowButton('.row-followup-btn', function (row, idx) { markSelectedRow(idx); openFollowUp(currentRun, row.slug, rowLabel(row)); });
  onRowButton('.row-replied-btn', function (row) { recordReply(row, true); });
  onRowButton('.row-unreply-btn', function (row) { recordReply(row, false); });
  onRowButton('.row-optout-btn', function (row) { recordOptOut(row); });
}

function rowLabel(row) {
  return row.business_name && row.business_name.trim() ? row.business_name : row.url;
}

function prospectUrl(run, slug, action) {
  return '/api/admin/prospects/' + encodeURIComponent(slug) + '/' + action + '?run=' + encodeURIComponent(run);
}

// Re-reads the rows and the follow-up panel after anything that changes a sequence, without
// closing whatever window is open.
async function refreshOutreach() {
  if (currentRun) {
    var data = await adminFetch('/api/admin/prospects?run=' + encodeURIComponent(currentRun));
    renderProspects(data.prospects || []);
  }
  await loadFollowUps();
}

async function recordReply(row, replied) {
  try {
    await adminFetch(prospectUrl(currentRun, row.slug, 'replied'), { method: 'POST', body: JSON.stringify({ replied: replied }) });
    await refreshOutreach();
  } catch (err) {
    window.alert(err.message);
  }
}

async function recordOptOut(row) {
  if (!window.confirm('Opt out ' + rowLabel(row) + '? Their address and website go on the suppression list and they are never emailed again.')) return;
  try {
    await adminFetch(prospectUrl(currentRun, row.slug, 'opt-out'), { method: 'POST', body: '{}' });
    await refreshOutreach();
  } catch (err) {
    window.alert(err.message);
  }
}

// The panel above the table: how the outreach is going, and every first email still waiting on
// its one follow-up, across all runs.
async function loadFollowUps() {
  var panel = document.getElementById('outreach-panel');
  var data;
  try {
    data = await adminFetch('/api/admin/prospects/follow-ups');
  } catch (err) {
    panel.style.display = 'none';
    return;
  }
  var st = data.stats || {};
  if (!st.sent) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  document.getElementById('outreach-stats').textContent =
    st.sent + ' emailed · ' + st.replied + ' replied · ' + st.optedOut + ' opted out · ' + st.followUpsSent + ' follow-ups sent · ' +
    st.sentLast7Days + ' of ' + st.weeklyLimit + ' sent in the last 7 days';
  var list = document.getElementById('followups-list');
  var items = data.followUps || [];
  list.innerHTML = items.map(function (f, i) {
    var due = f.state === 'due';
    return '<div class="followup-item">' +
      '<span>' + adminEscapeHtml(f.label || f.to || '') + ' <span class="when">' + (due ? 'follow-up due since ' : 'follow-up due ') + adminEscapeHtml(shortDate(f.dueAt)) + '</span></span>' +
      (due ? '<button type="button" class="btn btn-ghost followup-open-btn" data-i="' + i + '">Write follow-up →</button>' : '') +
      '</div>';
  }).join('');
  list.querySelectorAll('.followup-open-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = items[parseInt(btn.dataset.i, 10)];
      if (f) openFollowUp(f.run, f.slug, f.label);
    });
  });
}

// The follow-up is a fixed short note the server fills in (no model call). If it isn't due, the
// window says why and Send stays locked: the server refuses it too.
async function openFollowUp(run, slug, label) {
  var token = ++draftRequestToken;
  modalMode = 'followup';
  modalTarget = { run: run, slug: slug };
  sendLocked = true;
  var meta = document.getElementById('draft-meta');
  var banner = document.getElementById('draft-status-banner');
  var errEl = document.getElementById('send-error');
  var okEl = document.getElementById('send-success');
  var sendSubmit = document.getElementById('send-submit');
  ['already-sent-note', 'no-email-note'].forEach(function (id) { document.getElementById(id).style.display = 'none'; });
  document.getElementById('reload-draft-btn').style.display = 'none';
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  banner.style.display = 'none';
  document.getElementById('draft-title').textContent = 'Follow-up email';
  meta.textContent = 'Loading…';
  ['to', 'subject', 'body'].forEach(function (id) { document.getElementById(id).value = ''; });
  sendSubmit.disabled = true;
  openModal('draft-backdrop');
  try {
    var fu = await adminFetch(prospectUrl(run, slug, 'follow-up'));
    if (token !== draftRequestToken) return;
    meta.textContent = (label || '') + (fu.sentAt ? ' · first email sent ' + shortDate(fu.sentAt) : '');
    if (fu.state === 'due') {
      document.getElementById('to').value = fu.to || '';
      document.getElementById('subject').value = fu.subject || '';
      document.getElementById('body').value = fu.body || '';
      sendLocked = false;
      sendSubmit.disabled = false;
    } else {
      banner.textContent = fu.reason || 'A follow-up is not available for this prospect.';
      banner.style.display = 'block';
    }
  } catch (err) {
    if (token !== draftRequestToken) return;
    meta.textContent = '';
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

function markSelectedRow(idx) {
  document.querySelectorAll('#prospect-table-body tr').forEach(function (tr) {
    tr.classList.toggle('selected', parseInt(tr.dataset.idx, 10) === idx);
  });
}

async function selectProspect(idx) {
  var row = currentProspects[idx];
  if (!row) return;
  markSelectedRow(idx);
  if (!row.slug) {
    // No usable slug means the scan for this business never produced a report
    // (status=error rows have an empty json_path) — there's no draft or email
    // to show, so say that in its own small popup rather than opening the full
    // draft modal or leaving the click looking like a no-op.
    document.getElementById('row-error-note').textContent = row.status === 'error'
      ? 'Scan failed for this business' + (row.error_message ? ' (' + row.error_message + ')' : '') + ' — no contact email was captured.'
      : 'No contact email available for this prospect.';
    openModal('error-backdrop');
    return;
  }
  currentSlug = row.slug;
  // Once the first email has gone, the row is about the follow-up. Opening the first-email draft
  // again would invite a second "first" email and overwrite the sent record.
  if (row.sent) {
    await openFollowUp(currentRun, row.slug, rowLabel(row));
    return;
  }
  await loadDraft(row);
}

var currentVariant = null;

var STATUS_BANNER = {
  suppressed: 'Suppressed — this domain or contact is on the suppression list. Not sendable.',
  cooldown: null, // reason string from the API already says everything useful
  skipped_below_threshold: 'No finding here scored high enough to justify an email. Not sendable.',
  auto_rejected: null, // reason string from the API says why
};

// Bumped on every loadDraft so a slow or polling request for a prospect you've since moved away
// from can't write its result into the modal for the one you're now looking at.
var draftRequestToken = 0;
var DRAFT_CHECK_MAX_TRIES = 30; // x retryAfterSeconds (5s) = up to ~2.5 minutes for the site check

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// The first draft for a prospect has to wait for a site check (10 to 40 seconds), which the API
// reports as status "checking" rather than holding the request open. Ask again until it's done.
async function fetchDraftWhenReady(row, token, meta, fresh) {
  var url = '/api/admin/prospects/' + encodeURIComponent(row.slug) + '/draft?run=' + encodeURIComponent(currentRun) + (fresh ? '&fresh=1' : '');
  for (var attempt = 0; attempt < DRAFT_CHECK_MAX_TRIES; attempt += 1) {
    var draft = await adminFetch(url);
    if (token !== draftRequestToken) return null;
    if (draft.status !== 'checking') return draft;
    meta.textContent = (draft.reason || 'Checking their site…') + (attempt ? ' Still checking…' : '');
    await wait((draft.retryAfterSeconds || 5) * 1000);
    // Stop asking if you've opened another prospect or closed the modal in the meantime.
    if (token !== draftRequestToken || !document.getElementById('draft-backdrop').classList.contains('open')) return null;
  }
  throw new Error('The site check is taking too long. Close this and try again in a minute.');
}

// `fresh` asks for a newly written draft (a model call). Without it, a draft already written for
// this prospect is shown as saved.
async function loadDraft(row, fresh) {
  var token = ++draftRequestToken;
  modalMode = 'draft';
  modalTarget = { run: currentRun, slug: row.slug };
  sendLocked = false;
  document.getElementById('reload-draft-btn').style.display = '';
  var meta = document.getElementById('draft-meta');
  var alreadySent = document.getElementById('already-sent-note');
  var noEmailNote = document.getElementById('no-email-note');
  var draftBanner = document.getElementById('draft-status-banner');
  var errEl = document.getElementById('send-error');
  var okEl = document.getElementById('send-success');
  var sendSubmit = document.getElementById('send-submit');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  draftBanner.style.display = 'none';
  currentVariant = null;

  openModal('draft-backdrop');
  document.getElementById('draft-title').textContent = 'Draft outreach email';
  meta.textContent = 'Loading draft…';
  document.getElementById('subject').value = '';
  document.getElementById('body').value = '';
  document.getElementById('to').value = row.contact_email || '';
  sendSubmit.disabled = false;

  // The scan succeeded but found no mailto: link or plain-text email anywhere on the
  // site — the "To" field is left blank with no other signal, which reads exactly like
  // a broken click ("I clicked and there's no email"). Say so plainly instead.
  if (!row.contact_email) {
    noEmailNote.style.display = 'block';
    noEmailNote.textContent = 'No contact email was found on this business’s site — enter one manually to send.';
  } else {
    noEmailNote.style.display = 'none';
  }

  if (row.sent) {
    alreadySent.style.display = 'block';
    alreadySent.textContent = 'Already sent' + (row.sentAt ? ' — ' + adminFormatDate(row.sentAt) : '') + '. Sending again will overwrite the sent record.';
  } else {
    alreadySent.style.display = 'none';
  }

  try {
    var draft = await fetchDraftWhenReady(row, token, meta, fresh);
    if (!draft) return;
    var scoreLabel = (row.business_name && row.business_name.trim() ? row.business_name : row.url) + ' — score ' + (row.score == null ? '?' : row.score);
    // Confidence is the model's own guess: a label for you to weigh, not a reason to block.
    if (draft.confidence != null) scoreLabel += ' · confidence ' + draft.confidence + (draft.lowConfidence ? ' (low)' : '') + ' · variant ' + draft.variant;
    if (draft.saved && draft.generatedAt) scoreLabel += ' · saved draft from ' + adminFormatDate(draft.generatedAt);
    if (draft.leadsWith) scoreLabel += ' · leads with (' + draft.leadsWith.source + '): ' + draft.leadsWith.title;
    if (draft.siteCheck && draft.siteCheck.indexOf('unavailable') === 0) scoreLabel += ' · site check ' + draft.siteCheck;
    meta.textContent = scoreLabel;
    document.getElementById('subject').value = draft.subject || '';
    document.getElementById('body').value = draft.body || '';
    currentVariant = draft.variant || null;

    if (draft.status !== 'pending') {
      var msg = draft.reason || STATUS_BANNER[draft.status] || ('Not sendable (' + draft.status + ').');
      draftBanner.textContent = (draft.status === 'auto_rejected' ? 'Auto-rejected: ' : '') + msg;
      draftBanner.style.display = 'block';
      // auto_rejected still shows subject/body so you can judge whether the prompt is
      // being too conservative, but neither this nor any other non-pending status is
      // sendable as-is — force a manual override (edit + regenerate) rather than a stray click.
      sendSubmit.disabled = true;
    }
  } catch (err) {
    if (token !== draftRequestToken) return;
    meta.textContent = '';
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

async function loadProspects(run) {
  currentRun = run;
  currentSlug = null;
  closeModal('draft-backdrop');
  closeModal('error-backdrop');
  var data = await adminFetch('/api/admin/prospects?run=' + encodeURIComponent(run));
  renderProspects(data.prospects || []);
}

async function loadRuns() {
  var data = await adminFetch('/api/admin/prospects/runs');
  var runs = data.runs || [];
  var select = document.getElementById('run-select');
  var noRuns = document.getElementById('no-runs');

  if (!runs.length) {
    noRuns.style.display = 'block';
    select.style.display = 'none';
    return;
  }
  noRuns.style.display = 'none';
  select.style.display = 'inline-block';
  select.innerHTML = runs.map(function (r) {
    return '<option value="' + adminEscapeHtml(r.name) + '">' + adminEscapeHtml(r.name) + ' (' + r.count + ')</option>';
  }).join('');

  select.addEventListener('change', function () {
    loadProspects(select.value);
  });

  await loadProspects(select.value);
  await loadFollowUps();
}

requireAdminAuth().then(function () {
  loadQueue();
  return loadRuns();
});

document.getElementById('logout-btn').addEventListener('click', async function () {
  await adminFetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

// A non-pending draft disables Send by default, but editing it is exactly how the spec
// wants "rewriting more than a third of these" to surface as a prompt problem — so an edit
// re-enables Send rather than locking the admin out of overriding a flagged draft entirely.
['subject', 'body'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', function () {
    // Not for a follow-up that isn't due: typing in the box must not unlock that.
    if (!sendLocked) document.getElementById('send-submit').disabled = false;
  });
});

document.getElementById('reload-draft-btn').addEventListener('click', function () {
  if (!currentSlug) return;
  if (!window.confirm('Write a new draft? This is a new model call. It replaces the saved draft and discards your current edits.')) return;
  var row = currentProspects.find(function (r) { return r.slug === currentSlug; });
  if (row) loadDraft(row, true);
});

document.getElementById('send-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!modalTarget || sendLocked) return;
  var isFollowUp = modalMode === 'followup';
  var btn = document.getElementById('send-submit');
  var errEl = document.getElementById('send-error');
  var okEl = document.getElementById('send-success');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    await adminFetch(prospectUrl(modalTarget.run, modalTarget.slug, 'send'), {
      method: 'POST',
      body: JSON.stringify({
        to: document.getElementById('to').value.trim(),
        subject: document.getElementById('subject').value.trim(),
        body: document.getElementById('body').value,
        variant: isFollowUp ? null : currentVariant,
        followUp: isFollowUp,
      }),
    });
    okEl.textContent = isFollowUp ? 'Follow-up sent. That is the last email to this business.' : 'Sent.';
    okEl.style.display = 'block';
    // One follow-up only: lock the window so a second click can't send another.
    if (isFollowUp) sendLocked = true;
    // Refresh the rows and the panel behind the window without closing it (closing would lose
    // the confirmation the user just triggered it to see).
    var sentSlug = modalTarget.slug;
    await refreshOutreach();
    var idx = currentProspects.findIndex(function (r) { return r.slug === sentSlug; });
    if (idx !== -1) markSelectedRow(idx);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = sendLocked;
    btn.textContent = 'Send';
  }
});

// ---- Ready to send: every email that can go today, already written, across all runs ----------
//
// The server pre-writes the drafts (cron, or "Draft the rest" below), so this view is just
// read, tweak, Send or Skip. Edits are kept per prospect while the page is open, so a refresh of
// the list (after drafting finishes, or switching tabs) doesn't throw them away.

var queueItems = [];
var queueEdits = {}; // 'run:slug' -> { to, subject, body }
var queueDone = {}; // 'run:slug' -> 'sent' | 'skipped'
var queueWeekly = { remaining: 0, limit: 0, sentLast7Days: 0 };
var queueCounts = {};
var predraftPollTimer = null;

function queueKey(item) {
  return item.run + ':' + item.slug;
}

function showView(view) {
  document.getElementById('view-queue').style.display = view === 'queue' ? '' : 'none';
  document.getElementById('view-runs').style.display = view === 'runs' ? '' : 'none';
  document.getElementById('tab-queue').classList.toggle('current', view === 'queue');
  document.getElementById('tab-runs').classList.toggle('current', view === 'runs');
}

document.getElementById('tab-queue').addEventListener('click', function () {
  showView('queue');
  loadQueue();
});
document.getElementById('tab-runs').addEventListener('click', function () {
  showView('runs');
  if (currentRun) refreshOutreach();
});

function updateQueueTab() {
  var left = queueItems.filter(function (it) { return !queueDone[queueKey(it)]; }).length;
  document.getElementById('tab-queue').textContent = 'Ready to send (' + left + ')';
}

function renderQueueSummary() {
  var c = queueCounts;
  var w = queueWeekly;
  var ready = queueItems.filter(function (it) { return !it.flagged && !queueDone[queueKey(it)]; }).length;
  var flagged = queueItems.filter(function (it) { return it.flagged && !queueDone[queueKey(it)]; }).length;
  var parts = ['<strong>' + ready + '</strong> ready'];
  if (flagged) parts.push(flagged + ' flagged to fix');
  if (c.missingDraft) parts.push(c.missingDraft + ' without a draft yet');
  if (c.noFinding) parts.push(c.noFinding + ' with nothing worth an email');
  if (c.noEmail) parts.push(c.noEmail + ' with no email address');
  var cap = w.remaining > 0
    ? w.remaining + ' of ' + w.limit + ' sends left this week'
    : '<span class="queue-cap-zero">Weekly limit reached (' + w.limit + '/week). Sending is off until older sends age out.</span>';
  document.getElementById('queue-summary').innerHTML = parts.join(' · ') + '<br>' + cap;
  updateQueueTab();
}

function setPredraftUi(status) {
  var btn = document.getElementById('predraft-btn');
  var line = document.getElementById('predraft-status');
  var missing = queueCounts.missingDraft || 0;
  if (status && status.running) {
    btn.style.display = '';
    btn.disabled = true;
    btn.textContent = 'Drafting…';
    var p = status.progress;
    line.textContent = p
      ? 'Writing drafts: ' + p.done + ' of ' + p.total + ' done. About 30 seconds each; new ones appear here as they finish.'
      : 'A drafting run is in progress (started elsewhere, e.g. the scheduled job).';
    line.style.display = 'block';
    return;
  }
  btn.disabled = false;
  btn.textContent = 'Draft the rest (' + missing + ')';
  btn.style.display = missing ? '' : 'none';
  var last = status && status.last;
  if (last && last.finishedAt) {
    line.textContent = 'Last drafting run: ' + last.drafted + ' ready, ' + last.flagged + ' flagged, ' + last.noFinding + ' with nothing worth an email' +
      (last.checking ? ', ' + last.checking + ' still being checked (run it again)' : '') +
      (last.errors ? ', ' + last.errors + ' failed' : '') + '.';
    line.style.display = 'block';
  } else {
    line.style.display = 'none';
  }
}

function queueCardHtml(item, i) {
  var edit = queueEdits[queueKey(item)] || {};
  var site = item.siteUrl
    ? '<a href="' + attrEscape(item.siteUrl) + '" target="_blank" rel="noopener noreferrer">' + adminEscapeHtml(item.domain || item.siteUrl) + '</a>'
    : '';
  var meta = 'Batch ' + item.run + (item.score == null ? '' : ' · score ' + item.score);
  if (item.confidence != null) meta += ' · confidence ' + item.confidence;
  if (item.leadsWith) meta += ' · leads with (' + item.leadsWith.source + '): ' + item.leadsWith.title;
  if (item.generatedAt) meta += ' · drafted ' + adminFormatDate(item.generatedAt);
  return '<div class="card queue-card" data-i="' + i + '">' +
    '<h3>' + adminEscapeHtml(item.label) + site + '</h3>' +
    '<p class="draft-meta">' + adminEscapeHtml(meta) +
      (item.lowConfidence ? ' <span class="low-conf">(low confidence)</span>' : '') + '</p>' +
    (item.flagged
      ? '<p class="draft-status-banner">Flagged: ' + adminEscapeHtml(item.reason || item.status) + '. Fix it below, then Send.</p>'
      : '') +
    '<label>To</label><input type="email" class="q-to" value="' + attrEscape(edit.to != null ? edit.to : item.to) + '" />' +
    '<label>Subject</label><input type="text" class="q-subject" value="' + attrEscape(edit.subject != null ? edit.subject : item.subject) + '" />' +
    '<label>Body</label><textarea class="q-body">' + adminEscapeHtml(edit.body != null ? edit.body : item.body) + '</textarea>' +
    '<div class="queue-actions">' +
      '<button type="button" class="btn btn-primary q-send">Send</button>' +
      '<button type="button" class="btn btn-ghost q-skip">Skip</button>' +
      '<button type="button" class="btn btn-ghost q-open">Open full prospect</button>' +
    '</div>' +
    '<p class="queue-msg"></p>' +
    '</div>';
}

// Off at the weekly limit. A flagged draft needs an edit first, like the full prospect window.
function sendAllowed(item) {
  if (queueWeekly.remaining <= 0) return false;
  return !item.flagged || !!queueEdits[queueKey(item)];
}

function refreshSendButtons() {
  document.querySelectorAll('#queue-list .queue-card').forEach(function (card) {
    var item = queueItems[parseInt(card.dataset.i, 10)];
    var btn = card.querySelector('.q-send');
    if (item && btn && !queueDone[queueKey(item)]) btn.disabled = !sendAllowed(item);
  });
}

function renderQueue() {
  var list = document.getElementById('queue-list');
  var empty = document.getElementById('queue-empty');
  var visible = queueItems.filter(function (it) { return !queueDone[queueKey(it)]; });
  // The list re-renders while drafts are landing; put the cursor back where you were typing.
  var focus = null;
  var active = document.activeElement;
  var activeCard = active && active.closest ? active.closest('.queue-card') : null;
  if (activeCard && queueItems[parseInt(activeCard.dataset.i, 10)]) {
    focus = { key: queueKey(queueItems[parseInt(activeCard.dataset.i, 10)]), cls: active.className, start: active.selectionStart, end: active.selectionEnd };
  }
  list.innerHTML = queueItems.map(function (item, i) {
    return queueDone[queueKey(item)] ? '' : queueCardHtml(item, i);
  }).join('');
  if (!visible.length) {
    empty.textContent = queueCounts.missingDraft
      ? 'Nothing written yet. "Draft the rest" writes the emails (about 30 seconds each); they show up here as they finish.'
      : 'Nothing to send right now. New batches show up here once their emails are drafted.';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
  }
  list.querySelectorAll('.queue-card').forEach(function (card) {
    var item = queueItems[parseInt(card.dataset.i, 10)];
    var key = queueKey(item);
    ['q-to', 'q-subject', 'q-body'].forEach(function (cls) {
      card.querySelector('.' + cls).addEventListener('input', function () {
        queueEdits[key] = {
          to: card.querySelector('.q-to').value,
          subject: card.querySelector('.q-subject').value,
          body: card.querySelector('.q-body').value,
        };
        refreshSendButtons();
      });
    });
    card.querySelector('.q-send').addEventListener('click', function () { queueSend(item, card); });
    card.querySelector('.q-skip').addEventListener('click', function () { queueSkip(item, card); });
    card.querySelector('.q-open').addEventListener('click', function () { openFullProspect(item); });
    if (focus && focus.key === key && /^q-(to|subject|body)$/.test(focus.cls)) {
      var el = card.querySelector('.' + focus.cls);
      el.focus();
      try { el.setSelectionRange(focus.start, focus.end); } catch (e) { /* type=email has no selection */ }
    }
  });
  refreshSendButtons();
  renderQueueSummary();
}

function queueMessage(card, text, kind) {
  var el = card.querySelector('.queue-msg');
  el.className = 'queue-msg ' + (kind || '');
  el.textContent = text;
  el.style.display = text ? 'block' : 'none';
}

// Replaces a card with a one-line note once it has been dealt with, keeping its place in the list.
function finishCard(card, html) {
  card.classList.add('done');
  card.innerHTML = html;
}

async function queueSend(item, card) {
  var btn = card.querySelector('.q-send');
  if (btn.disabled) return;
  var to = card.querySelector('.q-to').value.trim();
  btn.disabled = true;
  btn.textContent = 'Sending…';
  queueMessage(card, '');
  try {
    await adminFetch(prospectUrl(item.run, item.slug, 'send'), {
      method: 'POST',
      body: JSON.stringify({
        to: to,
        subject: card.querySelector('.q-subject').value.trim(),
        body: card.querySelector('.q-body').value,
        variant: item.variant,
        // The server re-checks "already emailed / cooldown" for these, against double sends.
        fromQueue: true,
      }),
    });
    queueDone[queueKey(item)] = 'sent';
    delete queueEdits[queueKey(item)];
    queueWeekly.remaining = Math.max(0, queueWeekly.remaining - 1);
    queueWeekly.sentLast7Days += 1;
    finishCard(card, '<p class="already-sent-note" style="margin:0;">Sent to ' + adminEscapeHtml(to) + ' (' + adminEscapeHtml(item.label) + ').</p>');
    refreshSendButtons();
    renderQueueSummary();
  } catch (err) {
    btn.textContent = 'Send';
    btn.disabled = !sendAllowed(item);
    queueMessage(card, err.message, 'error');
  }
}

async function queueSkip(item, card) {
  try {
    await adminFetch(prospectUrl(item.run, item.slug, 'skip'), { method: 'POST', body: '{}' });
  } catch (err) {
    queueMessage(card, err.message, 'error');
    return;
  }
  queueDone[queueKey(item)] = 'skipped';
  finishCard(card, '<p class="muted" style="margin:0;font-size:13px;">Skipped ' + adminEscapeHtml(item.label) + '. ' +
    '<button type="button" class="seq-link q-unskip">Undo</button></p>');
  card.querySelector('.q-unskip').addEventListener('click', async function () {
    try {
      await adminFetch(prospectUrl(item.run, item.slug, 'skip'), { method: 'POST', body: JSON.stringify({ skipped: false }) });
      delete queueDone[queueKey(item)];
      renderQueue();
    } catch (err) {
      window.alert(err.message);
    }
  });
  renderQueueSummary();
}

// The existing per-prospect window, opened on the right batch.
async function openFullProspect(item) {
  showView('runs');
  var select = document.getElementById('run-select');
  if (currentRun !== item.run) {
    select.value = item.run;
    await loadProspects(item.run);
  }
  var idx = currentProspects.findIndex(function (r) { return r.slug === item.slug; });
  if (idx !== -1) await selectProspect(idx);
}

async function loadQueue() {
  var data;
  try {
    data = await adminFetch('/api/admin/prospects/queue');
  } catch (err) {
    document.getElementById('queue-summary').textContent = 'Could not load the send queue: ' + err.message;
    return;
  }
  queueItems = data.items || [];
  queueCounts = data.counts || {};
  queueWeekly = data.weekly || queueWeekly;
  // Sent and skipped prospects drop off the server's list; forget their local state with them.
  var keys = {};
  queueItems.forEach(function (it) { keys[queueKey(it)] = true; });
  Object.keys(queueDone).forEach(function (k) { if (!keys[k]) delete queueDone[k]; });
  renderQueue();
  setPredraftUi(data.predraft);
  if (data.predraft && data.predraft.running) pollPredraft();
}

// While drafts are being written, check every few seconds and show new ones as they land.
function pollPredraft() {
  if (predraftPollTimer) return;
  var lastDone = 0;
  predraftPollTimer = setInterval(async function () {
    var status;
    try {
      status = await adminFetch('/api/admin/prospects/predraft');
    } catch (err) {
      return;
    }
    if (!status.running) {
      clearInterval(predraftPollTimer);
      predraftPollTimer = null;
      await loadQueue();
      return;
    }
    setPredraftUi(status);
    var done = status.progress ? status.progress.done : lastDone;
    if (done !== lastDone) {
      lastDone = done;
      loadQueue();
    }
  }, 4000);
}

document.getElementById('predraft-btn').addEventListener('click', async function () {
  var btn = this;
  btn.disabled = true;
  try {
    setPredraftUi(await adminFetch('/api/admin/prospects/predraft', { method: 'POST', body: '{}' }));
  } catch (err) {
    // 409: a run is already going (perhaps the scheduled one); follow that instead.
    var line = document.getElementById('predraft-status');
    line.textContent = err.message;
    line.style.display = 'block';
  }
  pollPredraft();
});
