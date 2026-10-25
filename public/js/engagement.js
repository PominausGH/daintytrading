// Engagement events for Umami.
//
// Umami measures a visit as first event -> last event, so a visitor who reads
// one page and leaves shows 0 seconds. These events give it a second point:
//   engaged_15s / engaged_60s  - seconds the tab was actually visible (hidden tabs don't count)
//   scrolled_50                - reached half-way down the page
// Each fires at most once per page load. Bots that leave within a second never
// trigger them, so they also separate real readers from bot hits.
(function () {
  var THRESHOLDS = [15, 60];
  var fired = {};
  var visibleMs = 0;
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : null;

  function track(name, data) {
    if (fired[name]) return true;
    try {
      if (!window.umami || typeof window.umami.track !== 'function') return false;
      window.umami.track(name, data);
    } catch (e) { /* analytics must never break the page */ }
    fired[name] = true;
    return true;
  }

  function visibleSeconds() {
    var ms = visibleMs + (visibleSince ? Date.now() - visibleSince : 0);
    return ms / 1000;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (!visibleSince) visibleSince = Date.now();
    } else if (visibleSince) {
      visibleMs += Date.now() - visibleSince;
      visibleSince = null;
    }
  });

  // Polled rather than one setTimeout per threshold: the clock must pause while
  // the tab is hidden, and a check that ran before Umami loaded gets retried.
  var timer = setInterval(function () {
    var s = visibleSeconds();
    var pending = false;
    for (var i = 0; i < THRESHOLDS.length; i++) {
      var t = THRESHOLDS[i];
      if (fired['engaged_' + t + 's']) continue;
      if (s < t || !track('engaged_' + t + 's', { seconds: t })) pending = true;
    }
    if (!pending) clearInterval(timer);
  }, 1000);

  var scrollPending = false;
  function checkScroll() {
    scrollPending = false;
    if (fired.scrolled_50) return;
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    // Pages shorter than the viewport have nothing to scroll; skip them
    // rather than counting every short page as "scrolled".
    if (scrollable <= 0) return;
    if ((window.scrollY || doc.scrollTop) / scrollable >= 0.5 && track('scrolled_50', {})) {
      window.removeEventListener('scroll', onScroll);
    }
  }
  function onScroll() {
    if (scrollPending) return;
    scrollPending = true;
    setTimeout(checkScroll, 250);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();
