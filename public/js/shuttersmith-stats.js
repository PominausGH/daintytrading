// Weekly cron (api/scripts/update-project-view-stats.py) writes real Umami
// numbers to api/data/project-stats.json; the site is a static build, so
// every page that quotes the Shuttersmith visit count fetches this at
// runtime instead of baking the number in and needing a rebuild every week.
// Scoped narrowly per known location so it can't touch unrelated numbers
// (e.g. the "110 real visits" AI-chat stat on the SEO/GEO services page).
(function () {
  var DATED = /[\d,]+ real visits \(as of [^)]+\)/;
  var UNDATED = /^[\d,]+ real visits/;

  function replaceVisits(el, visits, asOf) {
    if (!el) return;
    if (DATED.test(el.textContent)) {
      el.innerHTML = el.innerHTML.replace(DATED, visits + ' real visits (as of ' + asOf + ')');
    } else if (UNDATED.test(el.textContent.trim())) {
      el.innerHTML = el.innerHTML.replace(/^([\d,]+) real visits/, visits + ' real visits');
    }
  }

  fetch('/api/project-stats')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      var s = data && data.shuttersmith;
      if (!s) return;
      var visits = s.visits.toLocaleString();

      // Homepage / work-page project-card outcome line
      document.querySelectorAll('a[href="/projects/shuttersmith.html"] .outcome-line').forEach(function (el) {
        replaceVisits(el, visits, s.asOf);
      });

      // Case-study page body paragraph
      document.querySelectorAll('article.prose p').forEach(function (el) {
        replaceVisits(el, visits, s.asOf);
      });

      // Case-study sidecard row ("Visits since July: 405 · majority via Google")
      document.querySelectorAll('.sidecard .label-row').forEach(function (row) {
        var spans = row.querySelectorAll('span');
        if (spans.length === 2 && spans[0].textContent.trim() === 'Visits since July') {
          spans[1].textContent = spans[1].textContent.replace(/^[\d,]+/, visits);
        }
      });

      // SEO/GEO services page result-card, matched by its Shuttersmith label
      document.querySelectorAll('.result-card').forEach(function (card) {
        var label = card.querySelector('.result-label');
        if (!label || label.textContent.indexOf('Shuttersmith') === -1) return;
        var stat = card.querySelector('.result-stat');
        if (stat) stat.textContent = visits + ' visits';
        card.querySelectorAll('p').forEach(function (p) {
          if (p !== label) replaceVisits(p, visits, s.asOf);
        });
      });
    })
    .catch(function () {});
})();
