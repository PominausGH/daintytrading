/**
 * Read-only project board. Every value comes from collect-overview.js, which
 * derives it from the audit rotation, uptime checks, git and the client
 * portal. Nothing on this page is editable on purpose: a board you have to
 * update by hand goes stale, and a stale board is worse than none.
 */
var STALE_AUDIT_DAYS = 8; // rotation is every 5 — 8 means it genuinely missed a turn

function daysSince(dateStr) {
  if (!dateStr) return null;
  var then = new Date(dateStr + 'T00:00:00Z').getTime();
  if (isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

function relDays(dateStr) {
  var d = daysSince(dateStr);
  if (d === null) return '—';
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return d + 'd ago';
}

function severityCell(f) {
  if (!f) return '<span class="muted-cell">never audited</span>';
  if (!f.open) return '<span class="muted-cell">none open</span>';
  var s = f.bySeverity || {};
  var bits = [];
  if (s.critical) bits.push('<span class="crit">' + s.critical + ' critical</span>');
  if (s.high) bits.push('<span class="high">' + s.high + ' high</span>');
  if (s.medium) bits.push(s.medium + ' med');
  if (s.low) bits.push(s.low + ' low');
  return '<span class="sev"><b>' + f.open + '</b> &middot; ' + bits.join(', ') + '</span>';
}

function checklistCell(c) {
  if (!c) return '<span class="muted-cell">—</span>';
  var parts = [];
  if (c.outstanding) parts.push(c.outstanding + ' to do');
  if (c.awaitingConfirmation) parts.push(c.awaitingConfirmation + ' to confirm');
  if (c.confirmed) parts.push(c.confirmed + ' done');
  if (!parts.length) return '<span class="muted-cell">empty</span>';
  return '<span class="sev">' + parts.join(', ') + '</span>';
}

function render(data) {
  document.getElementById('derived-note').innerHTML =
    'Every figure below is derived from the audit rotation, hourly uptime checks, git history and the client portal — nothing here is entered by hand. Generated ' +
    adminEscapeHtml(adminFormatDate(data.generatedAt)) + '.' +
    (data.dbReachable ? '' : ' <strong style="color:#f87171;">Postgres was unreachable when this ran, so own-site rows may be missing.</strong>');

  var c = data.counts || {};
  document.getElementById('tiles').innerHTML = [
    '<div class="tile"><div class="n">' + (c.total || 0) + '</div><div class="k">Sites tracked</div></div>',
    '<div class="tile"><div class="n">' + (c.clients || 0) + '</div><div class="k">Client sites</div></div>',
    '<div class="tile' + (c.blockedOnClient ? ' warn' : '') + '"><div class="n">' + (c.blockedOnClient || 0) + '</div><div class="k">Waiting on a client</div></div>',
    '<div class="tile' + (c.neverAudited ? ' warn' : '') + '"><div class="n">' + (c.neverAudited || 0) + '</div><div class="k">Never audited</div></div>',
  ].join('');
  document.getElementById('tiles').style.display = 'flex';

  // Most urgent first: down, then blocked on a client, then most open findings.
  var rows = (data.projects || []).slice().sort(function (a, b) {
    var down = function (p) { return p.site && p.site.status === 'down' ? 0 : 1; };
    if (down(a) !== down(b)) return down(a) - down(b);
    var blocked = function (p) { return p.findings ? p.findings.blockedOnClient : 0; };
    if (blocked(a) !== blocked(b)) return blocked(b) - blocked(a);
    var open = function (p) { return p.findings ? p.findings.open : -1; };
    return open(b) - open(a);
  });

  document.getElementById('p-body').innerHTML = rows.map(function (p) {
    var isDown = p.site && p.site.status === 'down';
    var staleDays = daysSince(p.lastAudited);
    var stale = staleDays !== null && staleDays > STALE_AUDIT_DAYS;

    var kindPill = p.kind === 'client'
      ? '<span class="pill pill-client">client</span>'
      : '<span class="pill pill-own">own</span>';

    // A client site with no recorded authorisation should be obvious.
    var authWarn = p.kind === 'client' && p.authorised === false
      ? ' <span class="pill pill-stale">no authorisation recorded</span>'
      : '';

    var code = p.code && p.code.lastCommit
      ? relDays(p.code.lastCommit) + '<span class="p-sub">' + adminEscapeHtml(p.code.subject || '') + '</span>'
      : '<span class="muted-cell">—</span>';

    return '<tr>' +
      '<td><span class="p-domain">' + adminEscapeHtml(p.domain) + '</span> ' + kindPill + authWarn +
        (p.client ? '<span class="p-sub">' + adminEscapeHtml(p.client) + '</span>' : '') + '</td>' +
      '<td>' + (p.site
          ? (isDown ? '<span class="pill pill-down">down</span>' : '<span class="muted-cell">up</span>')
          : '<span class="muted-cell">—</span>') + '</td>' +
      '<td>' + (p.lastAudited
          ? (stale ? '<span class="pill pill-stale">' + relDays(p.lastAudited) + '</span>' : '<span class="muted-cell">' + relDays(p.lastAudited) + '</span>')
          : '<span class="pill pill-stale">never</span>') + '</td>' +
      '<td>' + severityCell(p.findings) + '</td>' +
      '<td>' + (p.findings && p.findings.blockedOnClient
          ? '<span class="num-blocked">' + p.findings.blockedOnClient + '</span>'
          : '<span class="muted-cell">0</span>') + '</td>' +
      '<td>' + checklistCell(p.checklist) + '</td>' +
      '<td>' + code + '</td>' +
      '</tr>';
  }).join('');

  document.getElementById('p-table').style.display = 'table';
}

requireAdminAuth().then(function () {
  adminFetch('/api/admin/overview')
    .then(render)
    .catch(function (e) {
      document.getElementById('derived-note').textContent = '';
      var el = document.getElementById('p-error');
      el.textContent = e.message + ' — the collector runs on the host: node scripts/collect-overview.js';
      el.style.display = 'block';
    });

  var btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', function () {
      adminFetch('/api/admin/logout', { method: 'POST' }).then(function () {
        window.location.href = '/admin/login.html';
      });
    });
  }
});
