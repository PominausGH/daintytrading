// Weekly cron (api/scripts/update-project-view-stats.py) writes real Umami
// numbers to api/data/project-stats.json. The build bakes that file into every
// [data-stat="<project>.<field>"] node (src/data/project-stats.mjs); this
// refreshes the same nodes at runtime so the number stays current between
// builds. It only ever touches [data-stat] nodes, so every quote of a stat on a
// page moves together and unrelated numbers (e.g. the "110 real visits" AI-chat
// stat on the SEO/GEO services page) can't be hit.
(function () {
  fetch('/api/project-stats')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      document.querySelectorAll('[data-stat]').forEach(function (el) {
        var key = el.getAttribute('data-stat').split('.');
        var value = data[key[0]] && data[key[0]][key[1]];
        if (value == null) return;
        el.textContent = typeof value === 'number' ? value.toLocaleString('en-AU') : value;
      });
    })
    .catch(function () {});
})();
