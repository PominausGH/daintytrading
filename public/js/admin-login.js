document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = document.getElementById('login-submit');
  var errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  try {
    var res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: document.getElementById('password').value }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Login failed');
    window.location.href = '/admin/index.html';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Log in';
  }
});
