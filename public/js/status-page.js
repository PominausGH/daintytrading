function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return iso;
  }
}

var token = new URLSearchParams(window.location.search).get('token');

function showError() {
  document.getElementById('page-lede').textContent = 'This link isn’t valid.';
  document.getElementById('status-error').style.display = 'block';
}

function renderNotes(notes) {
  var list = document.getElementById('notes-list');
  if (!notes.length) {
    list.innerHTML = '<li class="muted">No notes yet.</li>';
    return;
  }
  list.innerHTML = notes.map(function (n) {
    var badge = n.author === 'studio' ? '<span class="note-badge">Dainty Trading</span> ' : '';
    var meta = badge + escapeHtml(n.name) + ' &middot; ' + formatDate(n.submittedAt) +
      (n.targetDate ? ' &middot; target: ' + escapeHtml(n.targetDate) : '');
    return '<li><div class="note-meta">' + meta + '</div><div class="note-text">' + escapeHtml(n.note) + '</div></li>';
  }).join('');
}

/**
 * Three states, deliberately distinct (see clients-store.js):
 *   verified — the audit independently confirmed it. Locked; not a checkbox.
 *   claimed  — they ticked it, we haven't confirmed yet. Still tickable, so a
 *              mis-tick can be undone.
 *   open     — outstanding.
 *
 * "Checking" is never shown as "done": some of these (Google Business Profile
 * edits especially) take days to show up, and telling someone a job is
 * complete before it's confirmed is how a checklist stops being trusted.
 */
function renderActions(actions) {
  var section = document.getElementById('actions-section');
  var list = document.getElementById('actions-list');
  if (!actions || !actions.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  // Outstanding first — the point of the list is what's left to do.
  var sorted = actions.slice().sort(function (a, b) {
    var rank = function (x) { return x.verifiedFixed ? 2 : x.claimedDone ? 1 : 0; };
    return rank(a) - rank(b);
  });

  list.innerHTML = sorted.map(function (a) {
    var state = a.verifiedFixed ? 'verified' : a.claimedDone ? 'claimed' : 'open';
    var note =
      state === 'verified'
        ? '<span class="action-state action-state-verified">Confirmed done' + (a.verifiedAt ? ' &middot; ' + formatDate(a.verifiedAt) : '') + '</span>'
        : state === 'claimed'
          ? '<span class="action-state action-state-claimed">You marked this done' + (a.claimedAt ? ' &middot; ' + formatDate(a.claimedAt) : '') + ' &mdash; we&rsquo;ll confirm at the next check</span>'
          : '';

    return (
      '<li class="action-item action-' + state + '">' +
      '<label>' +
      '<input type="checkbox" data-action-id="' + escapeHtml(a.id) + '"' +
      (a.claimedDone || a.verifiedFixed ? ' checked' : '') +
      (a.verifiedFixed ? ' disabled' : '') +
      ' />' +
      '<span class="action-text">' + escapeHtml(a.text) + '</span>' +
      '</label>' +
      note +
      '</li>'
    );
  }).join('');
}

function wireActions() {
  var list = document.getElementById('actions-list');
  var errEl = document.getElementById('actions-error');
  if (!list) return;

  list.addEventListener('change', function (e) {
    var box = e.target;
    if (!box || box.type !== 'checkbox') return;
    var id = box.getAttribute('data-action-id');
    if (!id) return;

    var desired = box.checked;
    box.disabled = true;
    errEl.style.display = 'none';

    fetch('/api/status/' + encodeURIComponent(token) + '/actions/' + encodeURIComponent(id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: desired }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('save failed');
        return r.json();
      })
      .then(function () {
        return fetch('/api/status/' + encodeURIComponent(token)).then(function (r) { return r.json(); });
      })
      .then(function (data) {
        renderActions(data.actions || []);
      })
      .catch(function () {
        // Put the box back where it was rather than leaving the page showing
        // a state the server never accepted.
        box.checked = !desired;
        box.disabled = false;
        errEl.textContent = 'Couldn’t save that just now. Please try again.';
        errEl.style.display = 'block';
      });
  });
}

function renderStatus(data) {
  document.getElementById('page-title').textContent = data.project;
  document.getElementById('page-lede').textContent = 'Status page for ' + data.clientName + '.';

  var card = document.getElementById('status-card');
  card.innerHTML =
    '<span class="status-pill">' + escapeHtml(data.status) + '</span>' +
    (data.phase ? '<div class="label-row"><span>Current phase</span><span>' + escapeHtml(data.phase) + '</span></div>' : '') +
    (data.nextMilestone ? '<div class="label-row"><span>Next milestone</span><span>' + escapeHtml(data.nextMilestone) + '</span></div>' : '') +
    (data.updatedAt ? '<div class="label-row"><span>Last updated</span><span>' + formatDate(data.updatedAt) + '</span></div>' : '');

  renderActions(data.actions || []);
  renderNotes(data.notes || []);
  document.getElementById('status-content').style.display = 'block';
}

if (!token) {
  showError();
} else {
  fetch('/api/status/' + encodeURIComponent(token))
    .then(function (res) {
      if (!res.ok) throw new Error('not found');
      return res.json();
    })
    .then(renderStatus)
    .catch(showError);

  wireActions();

  document.getElementById('dt_form_loaded_at').value = String(Date.now());

  document.getElementById('note-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = document.getElementById('note-submit');
    var errEl = document.getElementById('form-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var payload = {
      name: document.getElementById('name').value.trim(),
      note: document.getElementById('note').value.trim(),
      targetDate: document.getElementById('targetDate').value,
      dt_website: document.getElementById('dt_website').value,
      dt_form_loaded_at: document.getElementById('dt_form_loaded_at').value,
    };

    fetch('/api/status/' + encodeURIComponent(token) + '/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Something went wrong');
          return data;
        });
      })
      .then(function () {
        document.getElementById('note-form').reset();
        document.getElementById('dt_form_loaded_at').value = String(Date.now());
        return fetch('/api/status/' + encodeURIComponent(token)).then(function (r) { return r.json(); }).then(renderStatus);
      })
      .catch(function (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Add note';
      });
  });
}
