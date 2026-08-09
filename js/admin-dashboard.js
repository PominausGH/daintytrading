function renderClients(clients) {
  var table = document.getElementById('client-table');
  var body = document.getElementById('client-table-body');
  var empty = document.getElementById('empty-state');

  if (!clients.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  table.style.display = 'table';
  body.innerHTML = clients.map(function (c) {
    return '<tr>' +
      '<td><a href="/admin/client.html?token=' + encodeURIComponent(c.token) + '">' + adminEscapeHtml(c.clientName) + '</a></td>' +
      '<td>' + adminEscapeHtml(c.project) + '</td>' +
      '<td><span class="status-pill">' + adminEscapeHtml(c.status) + '</span></td>' +
      '<td>' + adminFormatDate(c.updatedAt) + '</td>' +
      '</tr>';
  }).join('');
}

async function loadClients() {
  var data = await adminFetch('/api/admin/clients');
  renderClients(data.clients || []);
}

requireAdminAuth().then(loadClients);

document.getElementById('logout-btn').addEventListener('click', async function () {
  await adminFetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/login.html';
});

document.getElementById('new-client-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = document.getElementById('new-client-submit');
  var errEl = document.getElementById('form-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    var record = await adminFetch('/api/admin/clients', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('name').value.trim(),
        project: document.getElementById('project').value.trim(),
      }),
    });
    document.getElementById('new-client-form').reset();
    await loadClients();
    window.location.href = '/admin/client.html?token=' + encodeURIComponent(record.token);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create';
  }
});
