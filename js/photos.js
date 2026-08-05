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
    var p = album.photos[idx];
    lbImg.src = base + '/web/' + p.f;
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

  // Swipe navigation on touch devices
  var touchX = null;
  lightbox.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });
})();
