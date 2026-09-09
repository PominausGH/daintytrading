document.getElementById('dt_form_loaded_at').value = String(Date.now());

var engagementEl = document.getElementById('engagement');
var urlFieldWrap = document.getElementById('url-field-wrap');
var urlInput = document.getElementById('url');
function toggleUrlField() {
  var needsUrl = engagementEl.value === 'SEO/GEO audit and fix';
  urlFieldWrap.style.display = needsUrl ? 'block' : 'none';
  urlInput.required = needsUrl;
}
engagementEl.addEventListener('change', toggleUrlField);
toggleUrlField();

document.getElementById('contact-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = document.getElementById('contact-submit');
  var errEl = document.getElementById('form-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending…';
  if (window.umami) window.umami.track('contact_submit_attempted');

  var payload = {
    name: document.getElementById('name').value.trim(),
    email: document.getElementById('email').value.trim(),
    company: document.getElementById('company').value.trim(),
    engagement: document.getElementById('engagement').value,
    url: document.getElementById('url').value.trim(),
    timeline: document.getElementById('timeline').value,
    message: document.getElementById('message').value.trim(),
    dt_website: document.getElementById('dt_website').value,
    dt_form_loaded_at: document.getElementById('dt_form_loaded_at').value,
  };

  try {
    var res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    document.getElementById('contact-form-wrap').style.display = 'none';
    document.getElementById('contact-success').style.display = 'block';
    if (window.umami) window.umami.track('lead_submitted');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send enquiry';
    if (window.umami) window.umami.track('contact_submit_failed', { reason: err.message });
  }
});
