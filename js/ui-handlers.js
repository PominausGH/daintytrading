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
