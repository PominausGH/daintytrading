var token = new URLSearchParams(window.location.search).get('token');
if (!token) window.location.href = '/admin/index.html';

function renderClient(client) {
  document.getElementById('page-title').textContent = client.clientName + ' — ' + client.project;
  document.getElementById('share-url').value = window.location.origin + '/status.html?token=' + token;
  document.getElementById('status').value = client.status || '';
  document.getElementById('phase').value = client.phase || '';
  document.getElementById('nextMilestone').value = client.nextMilestone || '';
  document.getElementById('notifyEmail').value = client.notifyEmail || '';
  renderNotes(client.noteHistory || []);
}

function renderNotes(notes) {
  var list = document.getElementById('notes-list');
  if (!notes.length) {
    list.innerHTML = '<li class="muted">No notes yet.</li>';
    return;
  }
  list.innerHTML = notes.map(function (n) {
    var badge = n.author === 'studio' ? '<span class="note-badge">Dainty Trading</span> ' : '';
    var meta = badge + adminEscapeHtml(n.name) + ' &middot; ' + adminFormatDate(n.submittedAt) +
      (n.targetDate ? ' &middot; target: ' + adminEscapeHtml(n.targetDate) : '') +
      (n.editedAt ? ' &middot; edited' : '');
    return (
      '<li data-id="' + adminEscapeHtml(n.id) + '">' +
        '<div class="note-meta"><span>' + meta + '</span>' +
          '<span class="note-actions">' +
            '<button type="button" class="btn btn-ghost edit-note-btn">Edit</button> ' +
            '<button type="button" class="btn btn-ghost delete-note-btn">Delete</button>' +
          '</span>' +
        '</div>' +
        '<div class="note-text">' + adminEscapeHtml(n.note) + '</div>' +
        '<form class="note-edit-form">' +
          '<textarea>' + adminEscapeHtml(n.note) + '</textarea>' +
          '<button type="submit" class="btn btn-primary">Save</button> ' +
          '<button type="button" class="btn btn-ghost cancel-edit-btn">Cancel</button>' +
        '</form>' +
      '</li>'
    );
  }).join('');

  list.querySelectorAll('.edit-note-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.closest('li').querySelector('.note-edit-form').style.display = 'block';
    });
  });
  list.querySelectorAll('.cancel-edit-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.closest('li').querySelector('.note-edit-form').style.display = 'none';
    });
  });
  list.querySelectorAll('.delete-note-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!window.confirm('Delete this note?')) return;
      var noteId = btn.closest('li').dataset.id;
      await adminFetch('/api/admin/clients/' + encodeURIComponent(token) + '/notes/' + encodeURIComponent(noteId), { method: 'DELETE' });
      await load();
    });
  });
  list.querySelectorAll('.note-edit-form').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var noteId = form.closest('li').dataset.id;
      var text = form.querySelector('textarea').value.trim();
      await adminFetch('/api/admin/clients/' + encodeURIComponent(token) + '/notes/' + encodeURIComponent(noteId), {
        method: 'PATCH',
        body: JSON.stringify({ note: text }),
      });
      await load();
    });
  });
}

async function load() {
  var client = await adminFetch('/api/admin/clients/' + encodeURIComponent(token));
  renderClient(client);
}

requireAdminAuth().then(load);

document.getElementById('logout-btn').addEventListener('click', async function () {
  await adminFetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

document.getElementById('copy-link-btn').addEventListener('click', function () {
  var input = document.getElementById('share-url');
  input.select();
  navigator.clipboard.writeText(input.value).then(function () {
    var btn = document.getElementById('copy-link-btn');
    var original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function () { btn.textContent = original; }, 1500);
  });
});

document.getElementById('status-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = document.getElementById('status-submit');
  var errEl = document.getElementById('status-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await adminFetch('/api/admin/clients/' + encodeURIComponent(token), {
      method: 'PATCH',
      body: JSON.stringify({
        status: document.getElementById('status').value.trim(),
        phase: document.getElementById('phase').value.trim(),
        nextMilestone: document.getElementById('nextMilestone').value.trim(),
        notifyEmail: document.getElementById('notifyEmail').value.trim(),
      }),
    });
    await load();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save status';
  }
});

document.getElementById('note-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = document.getElementById('note-submit');
  var errEl = document.getElementById('note-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    await adminFetch('/api/admin/clients/' + encodeURIComponent(token) + '/notes', {
      method: 'POST',
      body: JSON.stringify({
        note: document.getElementById('note-text').value.trim(),
        targetDate: document.getElementById('note-date').value || null,
      }),
    });
    document.getElementById('note-form').reset();
    await load();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add note';
  }
});
