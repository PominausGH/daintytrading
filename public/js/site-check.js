/* Free site checker page: domain + email -> emailed code -> code -> run -> report.
 *
 * Everything shown from the API is put on the page with textContent / setAttribute only, never
 * innerHTML: report text contains strings taken from the scanned website and must never be
 * interpreted as markup. No inline handlers or styles are injected (the site CSP forbids inline
 * script). Server: /api/site-check/* (api/routes/site-check.js).
 */
(function () {
  'use strict';

  var API = '/api/site-check';
  var CAL_URL = 'https://cal.daintytrading.com/andrewdainty/telaloom';
  var GROUPS = {
    findability: 'Being found (Google and AI assistants)',
    security: 'Security and trust',
    speed: 'Speed',
    measurement: 'Measurement'
  };
  var SEVERITY = { high: 'Important', medium: 'Worth fixing', low: 'Minor' };
  var PROGRESS = [
    'Looking at your homepage…',
    'Checking what AI assistants can see…',
    'Reading your robots.txt and sitemap…',
    'Checking security and speed…',
    'Nearly done…'
  ];

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    loadedAt: $('dt_form_loaded_at'),
    start: $('sc-step-start'), code: $('sc-step-code'), running: $('sc-step-running'), report: $('sc-step-report'),
    startForm: $('sc-start-form'), domain: $('sc-domain'), email: $('sc-email'), optin: $('sc-optin'),
    honeypot: $('dt_website'), startBtn: $('sc-start-btn'), startError: $('sc-start-error'),
    codeForm: $('sc-code-form'), codeInput: $('sc-code'), codeBtn: $('sc-code-btn'), codeError: $('sc-code-error'),
    sentTo: $('sc-sent-to'), resendBtn: $('sc-resend-btn'), changeBtn: $('sc-change-btn'),
    runningDomain: $('sc-running-domain'), progress: $('sc-progress'), runningError: $('sc-running-error'),
    reportBody: $('sc-report-body'), againBtn: $('sc-again-btn')
  };
  if (!els.startForm) return;
  els.loadedAt.value = String(Date.now());

  var state = { sessionId: null, domain: '', email: '', resendTimer: null, progressTimer: null, runId: 0 };

  function track(name, data) {
    try { if (window.umami) window.umami.track(name, data); } catch (e) { /* analytics must never break the page */ }
  }

  function show(step) {
    ['start', 'code', 'running', 'report'].forEach(function (s) { els[s].hidden = s !== step; });
    var focusTarget = { start: els.domain, code: els.codeInput, running: els.runningDomain, report: els.reportBody }[step];
    if (focusTarget) {
      if (focusTarget.tabIndex < 0 || focusTarget.tabIndex === undefined) focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: false });
    }
  }

  function setError(el, message) {
    el.textContent = message || '';
    el.hidden = !message;
  }

  function api(method, path, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(API + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || 'Something went wrong. Please try again.');
          err.code = data.code; err.status = res.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function busy(btn, on, label) {
    btn.disabled = on;
    if (label) btn.textContent = label;
  }

  // ---- step 1: domain + email -> code -----------------------------------------------------

  els.startForm.addEventListener('submit', function (e) {
    e.preventDefault();
    setError(els.startError, '');
    var domain = els.domain.value.trim();
    var email = els.email.value.trim();
    if (!domain || !email) { setError(els.startError, 'Enter your website address and your email.'); return; }
    busy(els.startBtn, true, 'Sending code…');
    track('sitecheck_start_attempted');
    api('POST', '/start', {
      domain: domain, email: email, optin: !!els.optin.checked,
      dt_website: els.honeypot.value, dt_form_loaded_at: els.loadedAt.value
    }).then(function (data) {
      state.sessionId = data.sessionId;
      state.domain = domain;
      state.email = email;
      els.sentTo.textContent = data.emailMasked || 'your email';
      els.codeInput.value = '';
      setError(els.codeError, '');
      show('code');
      startResendCooldown(60);
      track('sitecheck_code_sent', { optin: !!els.optin.checked });
    }).catch(function (err) {
      setError(els.startError, err.message);
      track('sitecheck_start_failed', { reason: err.code || 'error' });
    }).then(function () { busy(els.startBtn, false, 'Send my code'); });
  });

  // ---- step 2: code -> run ----------------------------------------------------------------

  function startResendCooldown(seconds) {
    clearInterval(state.resendTimer);
    var left = seconds;
    function tick() {
      if (left > 0) {
        els.resendBtn.disabled = true;
        els.resendBtn.textContent = 'Send a new code (' + left + 's)';
        left -= 1;
      } else {
        clearInterval(state.resendTimer);
        els.resendBtn.disabled = false;
        els.resendBtn.textContent = 'Send a new code';
      }
    }
    tick();
    state.resendTimer = setInterval(tick, 1000);
  }

  els.resendBtn.addEventListener('click', function () {
    setError(els.codeError, '');
    els.resendBtn.disabled = true;
    api('POST', '/resend', { sessionId: state.sessionId }).then(function () {
      startResendCooldown(60);
      track('sitecheck_code_resent');
    }).catch(function (err) {
      setError(els.codeError, err.message);
      if (err.code === 'expired') { goBackToStart(err.message); return; }
      startResendCooldown(err.data && err.data.retryAfterSeconds ? err.data.retryAfterSeconds : 30);
    });
  });

  els.changeBtn.addEventListener('click', function () { goBackToStart(''); });

  function goBackToStart(message) {
    clearInterval(state.resendTimer);
    state.sessionId = null;
    show('start');
    setError(els.startError, message);
  }

  els.codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    setError(els.codeError, '');
    var code = els.codeInput.value.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) { setError(els.codeError, 'Enter the 6-digit code from your email.'); return; }
    busy(els.codeBtn, true, 'Checking…');
    api('POST', '/verify', { sessionId: state.sessionId, code: code }).then(function (data) {
      track('sitecheck_verified');
      runCheck(data.jobId);
    }).catch(function (err) {
      if (err.code === 'locked' || err.code === 'expired') { goBackToStart(err.message); return; }
      var msg = err.message;
      if (err.code === 'wrong_code' && err.data && typeof err.data.attemptsLeft === 'number') {
        msg += ' ' + err.data.attemptsLeft + (err.data.attemptsLeft === 1 ? ' try' : ' tries') + ' left.';
      }
      setError(els.codeError, msg);
      track('sitecheck_verify_failed', { reason: err.code || 'error' });
    }).then(function () { busy(els.codeBtn, false, 'Run my check'); });
  });

  // ---- step 3: wait for the report --------------------------------------------------------

  function runCheck(jobId) {
    var runId = ++state.runId;
    clearInterval(state.resendTimer);
    els.runningDomain.textContent = state.domain;
    setError(els.runningError, '');
    show('running');
    var i = 0;
    els.progress.textContent = PROGRESS[0];
    clearInterval(state.progressTimer);
    state.progressTimer = setInterval(function () {
      i = Math.min(i + 1, PROGRESS.length - 1);
      els.progress.textContent = PROGRESS[i];
    }, 5000);
    var started = Date.now();
    var netFails = 0;

    function poll() {
      if (runId !== state.runId) return;
      api('GET', '/status/' + encodeURIComponent(jobId) + '?wait=1').then(function (data) {
        netFails = 0;
        if (data.status === 'running') {
          if (Date.now() - started > 130000) return slow();
          return poll();
        }
        clearInterval(state.progressTimer);
        if (data.status === 'done') return renderReport(data);
        fail(data.error || 'Something went wrong running the check. Please try again in a few minutes.');
      }).catch(function (err) {
        if (err.status === 404) return fail(err.message);
        netFails += 1;
        if (netFails >= 4) return fail('We lost the connection. If you don\'t see the report soon, check your email: we send a copy too.');
        setTimeout(poll, 2000);
      });
    }

    function slow() {
      clearInterval(state.progressTimer);
      els.progress.textContent = '';
      setError(els.runningError, 'This one is taking longer than usual. You can close this page: we\'ll email the report to ' + state.email + ' as soon as it\'s ready.');
    }

    function fail(message) {
      clearInterval(state.progressTimer);
      els.progress.textContent = '';
      setError(els.runningError, message);
      track('sitecheck_failed');
      var back = document.createElement('button');
      back.type = 'button';
      back.className = 'btn btn-ghost';
      back.textContent = 'Try again';
      back.addEventListener('click', function () { back.remove(); goBackToStart(''); });
      els.runningError.appendChild(document.createElement('br'));
      els.runningError.appendChild(back);
    }

    poll();
  }

  // ---- step 4: render the report (DOM API only) -------------------------------------------

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function link(href, text, className, umamiSource) {
    var a = el('a', className, text);
    a.href = href;
    a.setAttribute('data-umami-event', 'cta_click');
    a.setAttribute('data-umami-event-target', 'sitecheck_report_' + umamiSource);
    a.setAttribute('data-umami-event-source', 'site_check');
    if (href.indexOf('http') === 0) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }

  function renderReport(data) {
    var report = data.report || {};
    var rec = data.recommendation || {};
    var body = els.reportBody;
    while (body.firstChild) body.removeChild(body.firstChild);

    var title = el('h2', 'sc-report-title', 'Your site check: ' + (report.domain || state.domain));
    body.appendChild(title);
    var c = report.counts || {};
    var findings = report.findings || [];
    var summary = findings.length
      ? (c.high || 0) + ' important, ' + (c.medium || 0) + ' worth fixing, ' + (c.low || 0) + ' minor'
      : 'No issues found';
    var sub = summary + (report.platform ? ' · Looks like ' + report.platform : '') +
      (data.cached ? ' · from a check run in the last 24 hours' : '');
    body.appendChild(el('p', 'sc-summary', sub));
    if (report.finalUrl && report.domain && report.finalUrl.indexOf('//' + report.domain) === -1) {
      body.appendChild(el('p', 'sc-summary', 'That address redirects to ' + report.finalUrl));
    }

    var reco = el('div', 'sc-reco');
    reco.appendChild(el('strong', 'sc-reco-headline', rec.headline || ''));
    reco.appendChild(el('p', 'sc-reco-body', rec.body || ''));
    var actions = el('div', 'sc-actions');
    // Booking prominence comes from the server (recommendation.booking): the call is the main action
    // for Setup-sized and rebuild results, a quiet link for small/none results, and absent when we
    // couldn't check the site. Every booking link carries the domain (Cal.com notes prefill) and the
    // report outcome as Umami properties, so book_from_report shows which outcomes lead to calls.
    var booking = rec.booking || 'secondary';
    var bookHref = CAL_URL + '?Website_Ideas=' + encodeURIComponent((report.domain || state.domain) + ' - ') + '&notes=' + encodeURIComponent('Booked from the free site check');
    function bookLink(text, className) {
      var a = link(bookHref, text, className, 'book_call');
      a.setAttribute('data-umami-event', 'book_from_report');
      a.setAttribute('data-umami-event-outcome', rec.outcome || 'unknown');
      a.setAttribute('data-umami-event-prominence', booking);
      return a;
    }
    if (booking === 'primary') {
      actions.appendChild(bookLink('Book a free call \u2192', 'btn btn-primary'));
      actions.appendChild(link('/contact.html', 'Send us a message', 'btn btn-ghost', 'contact'));
    } else {
      actions.appendChild(link('/contact.html', 'Send us a message', 'btn btn-primary', 'contact'));
    }
    reco.appendChild(actions);
    if (booking === 'secondary') {
      var quiet = el('p', 'sc-summary sc-quiet', 'Rather talk it through? ');
      quiet.appendChild(bookLink('Book a free call', ''));
      reco.appendChild(quiet);
    }
    body.appendChild(reco);

    Object.keys(GROUPS).forEach(function (g) {
      var items = findings.filter(function (f) { return f.group === g; });
      if (!items.length) return;
      body.appendChild(el('h3', 'sc-group', GROUPS[g]));
      items.forEach(function (f) {
        var card = el('div', 'sc-finding');
        var pill = el('span', 'sc-pill sc-pill-' + (SEVERITY[f.severity] ? f.severity : 'low'), SEVERITY[f.severity] || 'Minor');
        card.appendChild(pill);
        card.appendChild(el('strong', 'sc-finding-title', f.title));
        card.appendChild(el('span', 'sc-finding-detail', f.detail));
        if (f.evidence) card.appendChild(el('span', 'sc-finding-evidence', 'What we saw: ' + f.evidence));
        body.appendChild(card);
      });
    });

    if ((report.good || []).length) {
      body.appendChild(el('h3', 'sc-group', 'What\'s already working'));
      var ul = el('ul', 'sc-list');
      report.good.forEach(function (g) { ul.appendChild(el('li', '', g)); });
      body.appendChild(ul);
    }

    var unseen = (report.notes || []).concat((report.notTested || []).map(function (n) { return n.check + ': ' + n.reason; }));
    if (unseen.length) {
      body.appendChild(el('h3', 'sc-group', 'What we couldn\'t see'));
      var ul2 = el('ul', 'sc-list sc-list-muted');
      unseen.forEach(function (n) { ul2.appendChild(el('li', '', n)); });
      body.appendChild(ul2);
    }

    body.appendChild(el('p', 'sc-footnote',
      'We\'ve emailed you a copy. This only looks at what any visitor or search engine can see, so treat it as a guide rather than a full audit.'));
    show('report');
    track('sitecheck_report_shown', { outcome: rec.outcome || report.outcome || 'unknown', status: report.status || 'unknown' });
  }

  els.againBtn.addEventListener('click', function () {
    els.domain.value = '';
    goBackToStart('');
  });
})();
