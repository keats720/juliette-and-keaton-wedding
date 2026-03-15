(function () {
  var params = new URLSearchParams(window.location.search);
  var code = params.get('code');
  if (!code) return;

  document.querySelectorAll('a[href]').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto:')) return;

    var parts = href.split('#');
    var base = parts[0];
    var hash = parts[1] ? '#' + parts[1] : '';
    var sep = base.indexOf('?') === -1 ? '?' : '&';
    a.setAttribute('href', base + sep + 'code=' + encodeURIComponent(code) + hash);
  });
})();
