/* Short enquiry form on service pages (src/components/QuickEnquiry.astro).
 * Same endpoint and spam fields as contact-form.js; the engagement comes from data-engagement. */
(function () {
  'use strict';
  var forms = document.querySelectorAll('form.qe-form');
  Array.prototype.forEach.call(forms, function (form) {
    form.querySelector('[name="dt_form_loaded_at"]').value = String(Date.now());
    var btn = form.querySelector('button[type="submit"]');
    var errEl = form.querySelector('.qe-error');
    var source = form.getAttribute('data-source') || 'service_page';

    function fail(msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Send it';
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errEl.hidden = true;
      var val = function (n) { return (form.querySelector('[name="' + n + '"]').value || '').trim(); };
      var payload = {
        name: val('name'),
        email: val('email'),
        message: val('message'),
        engagement: form.getAttribute('data-engagement') || '',
        company: '', url: '', timeline: '', budget: '', source: '',
        dt_website: form.querySelector('[name="dt_website"]').value,
        dt_form_loaded_at: val('dt_form_loaded_at'),
      };
      if (payload.name.length < 2) return fail('Please add your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return fail('Please add a valid email address.');
      if (payload.message.length < 10) return fail('Tell us a little more: one or two sentences is plenty.');

      btn.disabled = true;
      btn.textContent = 'Sending…';
      if (window.umami) window.umami.track('quick_enquiry_attempted', { source: source });
      try {
        var res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again, or email hello@telaloom.com.');
        form.hidden = true;
        form.parentNode.querySelector('.qe-done').hidden = false;
        if (window.umami) window.umami.track('lead_submitted', { source: source, form: 'quick_enquiry' });
      } catch (err) {
        fail(err.message);
        if (window.umami) window.umami.track('quick_enquiry_failed', { source: source, reason: err.message });
      }
    });
  });
})();
