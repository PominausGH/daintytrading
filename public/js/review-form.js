document.getElementById('dt_form_loaded_at').value = String(Date.now());

document.getElementById('review-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = document.getElementById('review-submit');
  var errEl = document.getElementById('form-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending…';

  var payload = {
    name: document.getElementById('name').value.trim(),
    company: document.getElementById('company').value.trim(),
    project: document.getElementById('project').value,
    rating: document.getElementById('rating').value,
    quote: document.getElementById('quote').value.trim(),
    email: document.getElementById('email').value.trim(),
    dt_website: document.getElementById('dt_website').value,
    dt_form_loaded_at: document.getElementById('dt_form_loaded_at').value,
  };

  try {
    var res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    document.getElementById('review-form-wrap').style.display = 'none';
    document.getElementById('review-success').style.display = 'block';
    if (window.umami) window.umami.track('review_submitted');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Submit review';
  }
});
