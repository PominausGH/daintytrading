async function adminFetch(url, options) {
  var res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
  if (res.status === 401) {
    window.location.href = '/admin/login.html';
    throw new Error('Not authenticated');
  }
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

async function requireAdminAuth() {
  try {
    var data = await adminFetch('/api/admin/session');
    if (!data.authenticated) {
      window.location.href = '/admin/login.html';
    }
  } catch (e) {
    window.location.href = '/admin/login.html';
  }
}

function adminEscapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function adminFormatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return iso;
  }
}
