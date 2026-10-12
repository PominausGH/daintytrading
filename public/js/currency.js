/* Shows prices in one currency at a time (see src/components/Price.astro).
 *
 * Loaded without `defer` on the pages that show prices so the choice is applied before the first
 * paint and overseas visitors don't see AUD flash to USD. Order of preference: what the visitor
 * picked last time, then their timezone (Australia -> AUD, anywhere else -> USD, the currency we
 * invoice international clients in). Without JavaScript, AUD shows.
 */
(function () {
  'use strict';
  var KEY = 'tl_currency';
  var root = document.documentElement;

  function stored() {
    try {
      var v = window.localStorage.getItem(KEY);
      return v === 'aud' || v === 'usd' ? v : null;
    } catch (e) { return null; }
  }

  function guess() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return 'aud';
      return tz.indexOf('Australia/') === 0 ? 'aud' : 'usd';
    } catch (e) { return 'aud'; }
  }

  function apply(cur) {
    root.setAttribute('data-currency', cur);
    var btns = document.querySelectorAll('[data-set-currency]');
    for (var i = 0; i < btns.length; i += 1) {
      btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-set-currency') === cur));
    }
  }

  var current = stored() || guess();
  apply(current);

  document.addEventListener('DOMContentLoaded', function () {
    var switches = document.querySelectorAll('.cur-switch');
    for (var i = 0; i < switches.length; i += 1) switches[i].hidden = false;
    apply(current);
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-set-currency]') : null;
      if (!btn) return;
      var next = btn.getAttribute('data-set-currency');
      if ((next !== 'aud' && next !== 'usd') || next === current) return;
      current = next;
      try { window.localStorage.setItem(KEY, current); } catch (err) { /* private mode: still switch for this page */ }
      apply(current);
      try { if (window.umami) window.umami.track('currency_switched', { to: current, page: location.pathname }); } catch (err2) { /* analytics must never break the page */ }
    });
  });
})();
