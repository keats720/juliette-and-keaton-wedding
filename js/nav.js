(function () {
  var nav = document.querySelector('.site-nav');
  var toggle = document.querySelector('.nav-toggle');

  // Restore menu state on page load
  if (sessionStorage.getItem('menuOpen') === '1') {
    nav.classList.add('open');
  }

  // Toggle and persist state
  toggle.addEventListener('click', function () {
    nav.classList.toggle('open');
    sessionStorage.setItem('menuOpen', nav.classList.contains('open') ? '1' : '0');
  });

  // Remove the inline onclick since we handle it here
  toggle.removeAttribute('onclick');
})();
