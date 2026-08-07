document.querySelectorAll('.nav-toggle').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.getElementById('main-nav').classList.toggle('nav-open');
  });
});

document.querySelectorAll('.phone-reveal-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var n = '+' + this.dataset.a + this.dataset.b + this.dataset.c;
    this.outerHTML = '<a href="tel:' + n + '" class="phone-revealed">' + n + '</a>';
  });
});

// Group counts (e.g. "18 products") are derived from the actual number of
// .project-card elements in each group, not hand-maintained — a manually
// kept count drifts every time a card is added, removed, or moved between
// groups (exactly what happened before this existed).
document.querySelectorAll('.project-group').forEach(function (group) {
  var countEl = group.querySelector('.group-count');
  if (!countEl) return;
  var count = group.querySelectorAll('.project-card').length;
  var unit = countEl.textContent.trim().split(/\s+/).slice(1).join(' ') || 'products';
  countEl.textContent = count + ' ' + unit;
});
