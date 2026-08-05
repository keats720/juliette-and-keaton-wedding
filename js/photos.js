(function () {
  var gallery = document.getElementById('gallery');
  var lightbox = document.getElementById('lightbox');
  var lbImg = lightbox.querySelector('.lightbox-img');
  var lbCount = lightbox.querySelector('.lightbox-count');
  var lbShare = lightbox.querySelector('.lightbox-share');
  var lbDownload = lightbox.querySelector('.lightbox-download');

  var base = '';
  var sections = [];
  var album = null;     // section currently open, or null for album list
  var current = -1;     // index within the open album

  fetch('photos-manifest.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (manifest) {
      base = manifest.baseUrl;
      sections = manifest.sections;
      route();
      window.addEventListener('hashchange', route);
    })
    .catch(function () {
      gallery.innerHTML = '<p class="photo-loading">Photos are coming soon — check back shortly!</p>';
    });

  function route() {
    var slug = location.hash.replace('#', '');
    var section = null;
    sections.forEach(function (s) { if (s.slug === slug) section = s; });
    if (section) renderAlbum(section);
    else renderAlbumList();
  }

  function renderAlbumList() {
    album = null;
    gallery.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'album-grid';
    sections.forEach(function (s) {
      var card = document.createElement('a');
      card.className = 'album-card';
      card.href = '#' + s.slug;
      var img = document.createElement('img');
      img.src = base + '/thumb/' + s.photos[0].f;
      img.loading = 'lazy';
      img.alt = s.title;
      var label = document.createElement('div');
      label.className = 'album-label';
      label.innerHTML = '<span class="album-title">' + s.title + '</span>' +
        '<span class="album-count">' + s.photos.length + ' photos</span>';
      card.appendChild(img);
      card.appendChild(label);
      grid.appendChild(card);
    });
    gallery.appendChild(grid);
    window.scrollTo(0, 0);
  }

  function renderAlbum(section) {
    album = section;
    gallery.innerHTML = '';

    var back = document.createElement('a');
    back.className = 'album-back';
    back.href = '#';
    back.textContent = '‹ All albums';
    gallery.appendChild(back);

    var h2 = document.createElement('h2');
    h2.className = 'photo-section-title';
    h2.textContent = section.title;
    gallery.appendChild(h2);

    var grid = document.createElement('div');
    grid.className = 'photo-grid';
    section.photos.forEach(function (p, idx) {
      var btn = document.createElement('button');
      btn.className = 'photo-thumb';
      btn.addEventListener('click', function () { open(idx); });
      var img = document.createElement('img');
      img.src = base + '/thumb/' + p.f;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = section.title + ' photo';
      btn.appendChild(img);
      grid.appendChild(btn);
    });
    gallery.appendChild(grid);
    window.scrollTo(0, 0);
  }

  /* ---- Lightbox ---- */

  function open(idx) {
    current = idx;
    resetZoom(false);
    var p = album.photos[idx];
    var webSrc = base + '/web/' + p.f;
    // Show the (usually cached) thumbnail instantly, swap in the sharp
    // version when it finishes loading — avoids a blank screen on cellular.
    lbImg.src = base + '/thumb/' + p.f;
    var hi = new Image();
    hi.onload = function () { if (current === idx) lbImg.src = webSrc; };
    hi.src = webSrc;
    lbCount.textContent = (idx + 1) + ' / ' + album.photos.length;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    preload(idx + 1); preload(idx - 1);
  }

  function preload(idx) {
    if (!album || idx < 0 || idx >= album.photos.length) return;
    var img = new Image();
    img.src = base + '/web/' + album.photos[idx].f;
  }

  function close() {
    lightbox.hidden = true;
    lbImg.src = '';
    resetZoom(false);
    document.body.style.overflow = '';
  }

  function step(delta) {
    var next = current + delta;
    if (!album || next < 0 || next >= album.photos.length) return;
    open(next);
  }

  function currentFile() {
    return album.photos[current].f;
  }

  function fetchBlob() {
    var f = currentFile();
    return fetch(base + '/full/' + f)
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        return new File([blob], f.split('/').pop(), { type: 'image/jpeg' });
      });
  }

  function busy(btn, label, work) {
    var original = btn.textContent;
    btn.textContent = label;
    btn.disabled = true;
    work().catch(function () {}).then(function () {
      btn.textContent = original;
      btn.disabled = false;
    });
  }

  lbShare.addEventListener('click', function () {
    busy(lbShare, 'Sharing…', function () {
      return fetchBlob().then(function (file) {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file] });
        }
        if (navigator.share) {
          return navigator.share({ url: base + '/full/' + currentFile() });
        }
        downloadFile(file);
      });
    });
  });

  // On iOS/Android the share sheet ("Save Image") is the native way to get a
  // photo into the camera roll; blob downloads land in the Files app instead.
  var nativeShare = !!(navigator.canShare && navigator.share);
  if (nativeShare) lbDownload.textContent = 'Save';

  lbDownload.addEventListener('click', function () {
    busy(lbDownload, 'Saving…', function () {
      return fetchBlob().then(function (file) {
        if (nativeShare && navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file] });
        }
        downloadFile(file);
      });
    });
  });

  function downloadFile(file) {
    var url = URL.createObjectURL(file);
    var a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  lightbox.querySelector('.lightbox-close').addEventListener('click', close);
  lightbox.querySelector('.lightbox-prev').addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
  lightbox.querySelector('.lightbox-next').addEventListener('click', function (e) { e.stopPropagation(); step(1); });
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) close(); });
  document.addEventListener('keydown', function (e) {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  /* ---- Touch gestures: swipe to navigate, pinch/double-tap to zoom, drag to pan ---- */
  var zoom = { s: 1, tx: 0, ty: 0 };
  var g = { pinch: false, x0: 0, y0: 0, tx0: 0, ty0: 0, d0: 0, s0: 1, moved: false, lastTap: 0 };

  function applyZoom(animate) {
    lbImg.classList.toggle('zoom-anim', !!animate);
    lbImg.style.transform = (zoom.s === 1 && !zoom.tx && !zoom.ty) ? '' :
      'translate(' + zoom.tx + 'px,' + zoom.ty + 'px) scale(' + zoom.s + ')';
  }

  function resetZoom(animate) {
    zoom = { s: 1, tx: 0, ty: 0 };
    applyZoom(animate);
  }

  function clampPan() {
    var r = lbImg.getBoundingClientRect();
    var maxX = Math.max(0, (r.width - window.innerWidth) / 2 + 40);
    var maxY = Math.max(0, (r.height - window.innerHeight) / 2 + 40);
    zoom.tx = Math.min(maxX, Math.max(-maxX, zoom.tx));
    zoom.ty = Math.min(maxY, Math.max(-maxY, zoom.ty));
  }

  function touchMid(e) {
    return { x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
             y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
  }
  function touchDist(e) {
    return Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                      e.touches[0].clientY - e.touches[1].clientY);
  }

  lightbox.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      g.pinch = true; g.d0 = touchDist(e); g.s0 = zoom.s;
      g.tx0 = zoom.tx; g.ty0 = zoom.ty;
    } else if (e.touches.length === 1) {
      g.x0 = e.touches[0].clientX; g.y0 = e.touches[0].clientY;
      g.tx0 = zoom.tx; g.ty0 = zoom.ty; g.moved = false;
    }
  }, { passive: true });

  lightbox.addEventListener('touchmove', function (e) {
    if (g.pinch && e.touches.length === 2) {
      e.preventDefault();
      var m = touchMid(e);
      var mx = m.x - window.innerWidth / 2, my = m.y - window.innerHeight / 2;
      var s = Math.min(4, Math.max(1, g.s0 * touchDist(e) / g.d0));
      zoom.s = s;
      zoom.tx = mx - (s / g.s0) * (mx - g.tx0);
      zoom.ty = my - (s / g.s0) * (my - g.ty0);
      clampPan(); applyZoom(false);
    } else if (!g.pinch && zoom.s > 1 && e.touches.length === 1) {
      e.preventDefault();
      zoom.tx = g.tx0 + (e.touches[0].clientX - g.x0);
      zoom.ty = g.ty0 + (e.touches[0].clientY - g.y0);
      g.moved = true;
      clampPan(); applyZoom(false);
    }
  }, { passive: false });

  lightbox.addEventListener('touchend', function (e) {
    if (g.pinch) {
      if (e.touches.length === 0) {
        g.pinch = false;
        if (zoom.s < 1.05) resetZoom(true);
      }
      return;
    }
    if (e.touches.length > 0) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    var isTap = Math.abs(dx) < 10 && Math.abs(dy) < 10 && e.target === lbImg;
    if (zoom.s === 1) {
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
        step(dx < 0 ? 1 : -1);
        return;
      }
      if (isTap) {
        var now = Date.now();
        if (now - g.lastTap < 300) {   // double-tap: zoom in at the tap point
          zoom.s = 2.5;
          zoom.tx = (t.clientX - window.innerWidth / 2) * (1 - 2.5);
          zoom.ty = (t.clientY - window.innerHeight / 2) * (1 - 2.5);
          clampPan(); applyZoom(true);
          g.lastTap = 0;
        } else { g.lastTap = now; }
      }
    } else if (!g.moved && isTap) {
      var now2 = Date.now();
      if (now2 - g.lastTap < 300) { resetZoom(true); g.lastTap = 0; }
      else { g.lastTap = now2; }
    }
  }, { passive: true });
})();
