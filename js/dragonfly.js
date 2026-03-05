(function() {
  var footer = document.querySelector('.site-footer');
  if (!footer) return;

  var wrap = document.createElement('div');
  wrap.className = 'dragonfly-tracker';
  wrap.setAttribute('aria-hidden', 'true');

  wrap.innerHTML =
    '<div class="dragonfly-flipper">' +
      '<div class="dragonfly-floater">' +
        '<svg class="dragonfly-svg" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">' +
          '<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">' +
            '<path class="body" d="M 100,75 C 95,65 92,68 95,72 C 100,78 105,75 100,75" />' +
            '<path class="tail" d="M 100,75 C 140,110 170,135 185,140 C 190,141 193,137 190,133 C 185,130 165,133 185,135 C 190,137 185,140 185,133 C 180,128 160,133 100,75" />' +
            '<path class="wing wing-top" d="M 100,75 C 20,10 10,70 100,75" />' +
            '<path class="wing wing-bottom" d="M 100,75 C 1,90 55,140 100,75" />' +
            '<path class="wing wing-top" d="M 100,75 C 200,0 195,60 100,75" />' +
            '<path class="wing wing-bottom" d="M 100,75 C 190,65 195,120 100,75" />' +
          '</g>' +
        '</svg>' +
      '</div>' +
    '</div>';

  footer.insertBefore(wrap, footer.firstChild);

  var flipper = wrap.querySelector('.dragonfly-flipper');
  var width = 80;
  var halfWidth = width / 2;
  var currentX = window.innerWidth / 2;
  var targetX = window.innerWidth / 2;
  var scaleX = 1;
  var maxSpeed = 0.25;
  var acceleration = 0.04;

  document.addEventListener('mousemove', function(e) {
    targetX = e.clientX;
    if (targetX > currentX + 5) scaleX = -1;
    else if (targetX < currentX - 5) scaleX = 1;
    flipper.style.transform = 'scaleX(' + scaleX + ')';
  }, { passive: true });

  function animate() {
    var distance = targetX - currentX;
    var speed = distance * acceleration;
    if (speed > maxSpeed) speed = maxSpeed;
    if (speed < -maxSpeed) speed = -maxSpeed;
    currentX += speed;
    var rect = footer.getBoundingClientRect();
    var left = currentX - halfWidth - rect.left;
    wrap.style.left = left + 'px';
    requestAnimationFrame(animate);
  }
  animate();
})();
