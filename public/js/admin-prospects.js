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

requireAdminAuth().then(loadRuns);

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
