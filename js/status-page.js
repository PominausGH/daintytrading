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

function renderStatus(data) {
  document.getElementById('page-title').textContent = data.project;
  document.getElementById('page-lede').textContent = 'Status page for ' + data.clientName + '.';

  var card = document.getElementById('status-card');
  card.innerHTML =
    '<span class="status-pill">' + escapeHtml(data.status) + '</span>' +
    (data.phase ? '<div class="label-row"><span>Current phase</span><span>' + escapeHtml(data.phase) + '</span></div>' : '') +
    (data.nextMilestone ? '<div class="label-row"><span>Next milestone</span><span>' + escapeHtml(data.nextMilestone) + '</span></div>' : '') +
    (data.updatedAt ? '<div class="label-row"><span>Last updated</span><span>' + formatDate(data.updatedAt) + '</span></div>' : '');

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
