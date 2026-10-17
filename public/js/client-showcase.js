/* Client-site carousel + before/after sliders (src/components/ClientShowcase.astro). */
(function () {
  'use strict';
  Array.prototype.forEach.call(document.querySelectorAll('[data-showcase]'), function (root) {
    var track = root.querySelector('[data-track]');
    var prev = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');
    var cur = root.querySelector('[data-cur]');
    var count = track.children.length;

    function index() { return Math.round(track.scrollLeft / track.clientWidth); }
    function sync() {
      var i = index();
      if (cur) cur.textContent = String(i + 1).padStart(2, '0');
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= count - 1;
    }
    function go(step) {
      track.scrollTo({ left: (index() + step) * track.clientWidth, behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    var queued = false;
    track.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; sync(); });
    });
    track.addEventListener('keydown', function (e) {
      if (e.target !== track) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    sync();

    Array.prototype.forEach.call(root.querySelectorAll('[data-compare]'), function (cmp) {
      var input = cmp.querySelector('input[type="range"]');
      var tracked = false;
      input.addEventListener('input', function () {
        cmp.style.setProperty('--pos', input.value + '%');
        if (!tracked && window.umami) {
          tracked = true;
          window.umami.track('showcase_compare', { client: cmp.getAttribute('data-slug') || '' });
        }
      });
    });
  });
})();
