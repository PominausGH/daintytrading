var currentRun = null;
var currentProspects = [];
var currentSlug = null;

function statusPillHtml(row) {
  var cls = row.status === 'error' ? 'status-pill error' : 'status-pill';
  return '<span class="' + cls + '">' + adminEscapeHtml(row.status || 'unknown') + '</span>';
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
    return '<tr data-idx="' + idx + '">' +
      '<td><div class="biz">' + adminEscapeHtml(label) + '</div><div class="url">' + adminEscapeHtml(row.url) + '</div></td>' +
      '<td>' + (row.score == null ? '—' : adminEscapeHtml(String(row.score))) + '</td>' +
      '<td>' + (row.findings_count == null ? '—' : adminEscapeHtml(String(row.findings_count))) + '</td>' +
      '<td>' + (row.high_severity_count == null ? '—' : adminEscapeHtml(String(row.high_severity_count))) + '</td>' +
      '<td>' + statusPillHtml(row) + '</td>' +
      '<td>' + (row.sent ? '<span class="sent-pill">Sent</span>' : '') + '</td>' +
      '</tr>';
  }).join('');

  body.querySelectorAll('tr').forEach(function (tr) {
    tr.addEventListener('click', function () {
      var idx = parseInt(tr.dataset.idx, 10);
      selectProspect(idx);
    });
  });
}

function markSelectedRow(idx) {
  document.querySelectorAll('#prospect-table-body tr').forEach(function (tr) {
    tr.classList.toggle('selected', parseInt(tr.dataset.idx, 10) === idx);
  });
}

async function selectProspect(idx) {
  var row = currentProspects[idx];
  if (!row || !row.slug) return;
  markSelectedRow(idx);
  currentSlug = row.slug;
  await loadDraft(row);
}

var currentVariant = null;

var STATUS_BANNER = {
  suppressed: 'Suppressed — this domain or contact is on the suppression list. Not sendable.',
  cooldown: null, // reason string from the API already says everything useful
  skipped_below_threshold: 'No finding here scored high enough to justify an email. Not sendable.',
  auto_rejected: null, // reason string from the API says why
};

async function loadDraft(row) {
  var card = document.getElementById('draft-card');
  var meta = document.getElementById('draft-meta');
  var alreadySent = document.getElementById('already-sent-note');
  var draftBanner = document.getElementById('draft-status-banner');
  var errEl = document.getElementById('send-error');
  var okEl = document.getElementById('send-success');
  var sendSubmit = document.getElementById('send-submit');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  draftBanner.style.display = 'none';
  currentVariant = null;

  card.style.display = 'block';
  document.getElementById('draft-title').textContent = 'Draft outreach email';
  meta.textContent = 'Loading draft…';
  document.getElementById('subject').value = '';
  document.getElementById('body').value = '';
  document.getElementById('to').value = row.contact_email || '';
  sendSubmit.disabled = false;

  if (row.sent) {
    alreadySent.style.display = 'block';
    alreadySent.textContent = 'Already sent' + (row.sentAt ? ' — ' + adminFormatDate(row.sentAt) : '') + '. Sending again will overwrite the sent record.';
  } else {
    alreadySent.style.display = 'none';
  }

  try {
    var draft = await adminFetch('/api/admin/prospects/' + encodeURIComponent(row.slug) + '/draft?run=' + encodeURIComponent(currentRun));
    var scoreLabel = (row.business_name && row.business_name.trim() ? row.business_name : row.url) + ' — score ' + (row.score == null ? '?' : row.score);
    if (draft.confidence != null) scoreLabel += ' · confidence ' + draft.confidence + ' · variant ' + draft.variant;
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
    meta.textContent = '';
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

async function loadProspects(run) {
  currentRun = run;
  currentSlug = null;
  document.getElementById('draft-card').style.display = 'none';
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
    document.getElementById('send-submit').disabled = false;
  });
});

document.getElementById('reload-draft-btn').addEventListener('click', function () {
  if (!currentSlug) return;
  if (!window.confirm('Regenerate the draft? This will discard your current edits.')) return;
  var row = currentProspects.find(function (r) { return r.slug === currentSlug; });
  if (row) loadDraft(row);
});

document.getElementById('send-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (!currentSlug) return;
  var btn = document.getElementById('send-submit');
  var errEl = document.getElementById('send-error');
  var okEl = document.getElementById('send-success');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    var result = await adminFetch('/api/admin/prospects/' + encodeURIComponent(currentSlug) + '/send?run=' + encodeURIComponent(currentRun), {
      method: 'POST',
      body: JSON.stringify({
        to: document.getElementById('to').value.trim(),
        subject: document.getElementById('subject').value.trim(),
        body: document.getElementById('body').value,
        variant: currentVariant,
      }),
    });
    okEl.textContent = 'Sent.';
    okEl.style.display = 'block';
    // Update the in-memory row + table without reloading (a reload would hide the
    // draft card and lose the confirmation message the user just triggered it to see).
    var idx = currentProspects.findIndex(function (r) { return r.slug === currentSlug; });
    if (idx !== -1) {
      currentProspects[idx].sent = true;
      currentProspects[idx].sentAt = result.sent && result.sent.sentAt;
      renderProspects(currentProspects);
      markSelectedRow(idx);
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
});
