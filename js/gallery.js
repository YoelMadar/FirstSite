/* =========================================================
   גלריית חתונה — לוגיקה
   טעינה עצלה (lazy), סינון קטגוריות, ו-Lightbox עם מקלדת.
   בנוי להתמודד עם אלפי תמונות בלי להתקע.
   ========================================================= */
(function () {
  'use strict';

  var PHOTOS = Array.isArray(window.WEDDING_PHOTOS) ? window.WEDDING_PHOTOS : [];
  var BATCH = 80; // כמה תמונות מרנדרים בכל פעם (ביצועים)

  var grid       = document.getElementById('grid');
  var filterWrap = document.getElementById('filterButtons');
  var emptyState = document.getElementById('emptyState');
  var loadHint   = document.getElementById('loadHint');
  var toTop      = document.getElementById('toTop');

  // --- מצב ---
  var activeCat = 'all';
  var visible   = [];   // התמונות המסוננות הנוכחיות
  var rendered  = 0;    // כמה כבר רונדרו מתוך visible

  // ---------- בניית כפתורי הסינון ----------
  function buildFilters() {
    var counts = { all: PHOTOS.length };
    var labels = {};
    var order  = [];
    PHOTOS.forEach(function (p) {
      if (!(p.category in counts)) { counts[p.category] = 0; labels[p.category] = p.label || p.category; order.push(p.category); }
      counts[p.category]++;
    });

    var cats = [['all', 'הכול']].concat(order.map(function (c) { return [c, labels[c]]; }));
    filterWrap.innerHTML = '';
    cats.forEach(function (pair) {
      var btn = document.createElement('button');
      btn.className = 'filter-btn' + (pair[0] === 'all' ? ' is-active' : '');
      btn.type = 'button';
      btn.dataset.cat = pair[0];
      btn.innerHTML = pair[1] + ' <small>' + counts[pair[0]] + '</small>';
      btn.addEventListener('click', function () { setCategory(pair[0], true); });
      filterWrap.appendChild(btn);
    });
  }

  // ---------- סינון ----------
  function setCategory(cat, scroll) {
    activeCat = cat;
    Array.prototype.forEach.call(filterWrap.children, function (b) {
      b.classList.toggle('is-active', b.dataset.cat === cat);
    });
    visible = (cat === 'all') ? PHOTOS.slice() : PHOTOS.filter(function (p) { return p.category === cat; });
    grid.innerHTML = '';
    rendered = 0;
    emptyState.hidden = visible.length > 0;
    renderMore();
    if (scroll) {
      var filters = document.querySelector('.filters');
      window.scrollTo({ top: filters.offsetTop, behavior: 'smooth' });
    }
  }

  // ---------- רינדור מדורג ----------
  function renderMore() {
    var end = Math.min(rendered + BATCH, visible.length);
    var frag = document.createDocumentFragment();
    for (var i = rendered; i < end; i++) {
      frag.appendChild(makeTile(visible[i], i));
    }
    grid.appendChild(frag);
    rendered = end;
    updateHint();
    // הפעלת המעקב על האריחים החדשים
    Array.prototype.forEach.call(grid.querySelectorAll('.tile:not([data-watched])'), function (t) {
      t.setAttribute('data-watched', '1');
      io.observe(t);
    });
  }

  function makeTile(photo, index) {
    var tile = document.createElement('figure');
    tile.className = 'tile';
    tile.dataset.index = index;

    var img = document.createElement('img');
    img.alt = photo.alt || photo.label || 'תמונה מהחתונה';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.src = photo.src; // נטען רק כשנכנס לתצוגה

    var tag = document.createElement('figcaption');
    tag.className = 'tile__tag';
    tag.textContent = photo.label || '';

    tile.appendChild(img);
    tile.appendChild(tag);
    tile.addEventListener('click', function () { openLightbox(index); });
    return tile;
  }

  function updateHint() {
    if (!loadHint) return;
    if (rendered >= visible.length) {
      loadHint.textContent = visible.length + ' תמונות';
    } else {
      loadHint.textContent = 'מציג ' + rendered + ' מתוך ' + visible.length + ' · גללו לעוד';
    }
  }

  // ---------- IntersectionObserver: טעינת תמונה + אנימציית כניסה ----------
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var tile = e.target;
      var img = tile.querySelector('img');
      if (img && img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
      tile.classList.add('is-in');
      io.unobserve(tile);
    });
  }, { rootMargin: '300px 0px' });

  // ---------- גלילה אינסופית ----------
  var sentinelTick = false;
  window.addEventListener('scroll', function () {
    if (sentinelTick) return;
    sentinelTick = true;
    requestAnimationFrame(function () {
      sentinelTick = false;
      var nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200;
      if (nearBottom && rendered < visible.length) renderMore();
      if (toTop) toTop.classList.toggle('is-visible', window.scrollY > 600);
    });
  }, { passive: true });

  // ======================= LIGHTBOX =======================
  var lb        = document.getElementById('lightbox');
  var lbImg     = document.getElementById('lbImg');
  var lbCap     = document.getElementById('lbCaption');
  var lbCounter = document.getElementById('lbCounter');
  var lbDl      = document.getElementById('lbDownload');
  var lbCurrent = -1;

  function openLightbox(index) {
    lbCurrent = index;
    showCurrent();
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.hidden = true;
    document.body.style.overflow = '';
    lbCurrent = -1;
  }
  function step(dir) {
    if (!visible.length) return;
    lbCurrent = (lbCurrent + dir + visible.length) % visible.length;
    // לוודא שהאריח רונדר (לגלילה אינסופית) — לא חובה לתמונה עצמה
    showCurrent();
  }
  function showCurrent() {
    var p = visible[lbCurrent];
    if (!p) return;
    lbImg.src = p.src;
    lbImg.alt = p.alt || p.label || '';
    lbCap.textContent = p.label || '';
    lbCounter.textContent = (lbCurrent + 1) + ' / ' + visible.length;
    lbDl.href = p.src;
    lbDl.setAttribute('download', fileName(p.src));
  }
  function fileName(src) {
    var base = src.split('/').pop() || 'wedding-photo';
    return base;
  }

  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  document.getElementById('lbPrev').addEventListener('click', function () { step(+1); }); // RTL: "הקודם" מימין
  document.getElementById('lbNext').addEventListener('click', function () { step(-1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') step(+1); // ב-RTL ימינה = הקודם
    else if (e.key === 'ArrowLeft')  step(-1);
  });

  // מחוות מגע (החלקה) ל-Lightbox
  var touchX = null;
  lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx > 0 ? -1 : +1);
    touchX = null;
  }, { passive: true });

  // ======================= אתחול =======================
  function init() {
    if (!PHOTOS.length) {
      emptyState.hidden = false;
      emptyState.textContent = 'עדיין לא נוספו תמונות. ראו את README להוספת התמונות שלכם.';
      return;
    }
    buildFilters();
    setCategory('all');
  }
  init();
})();
