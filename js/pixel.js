/* SecondLook — pixel artwork and settling headlines for the landing page.
 * paint(root): draws an ordered-dither (Bayer 4x4) planet into every canvas[data-pixel].
 *   Colour comes from the canvas's CSS colour, so it follows Sober/Night mode.
 * settle(el): the letters of a headline drift into place when it scrolls into view.
 *   Screen readers get the plain sentence; the moving letters are aria-hidden.
 * Both are decorative: nothing here changes what the page says or does. */
(function (root) {
  'use strict';

  var MAX_DPR = 2;
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var LIGHT = norm([-0.55, -0.62, 0.56]);
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  // A small seeded random, so the stars sit in the same place on every paint.
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  // Where the planet sits in each kind of canvas: centre (x, y) and radius, as fractions.
  var LAYOUTS = {
    hero: function (w, h) { var r = Math.min(w, h) * 0.47; return { x: w / 2, y: h / 2, r: r, cell: w < 420 ? 5 : 6, stars: 26 }; },
    corner: function (w, h) { var r = Math.max(120, Math.min(w, h) * 0.42); return { x: w - r * 0.35, y: r * 0.2, r: r, cell: 5, stars: 0 }; },
    cta: function (w, h) { var r = Math.max(140, h * 0.62); return { x: w - r * 0.3, y: h + r * 0.15, r: r, cell: 6, stars: 18 }; }
  };

  function drawPlanet(canvas) {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var ctx = canvas.getContext('2d');
    if (!ctx) return true;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = getComputedStyle(canvas).color;

    var L = (LAYOUTS[canvas.getAttribute('data-pixel')] || LAYOUTS.hero)(w, h);
    var c = L.cell, px = c - 1; // one-pixel gap between cells keeps the "pixel" look
    var cols = Math.ceil(w / c), rows = Math.ceil(h / c);
    for (var j = 0; j < rows; j++) {
      var y = j * c + c / 2, dy = (y - L.y) / L.r;
      for (var i = 0; i < cols; i++) {
        var x = i * c + c / 2, dx = (x - L.x) / L.r;
        var d2 = dx * dx + dy * dy, t = (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16, b;
        if (d2 <= 1) {
          var nz = Math.sqrt(1 - d2);
          b = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
          b = 0.1 + 0.9 * Math.pow(b, 0.8);
          // a band of latitude lines, like the planet's weather
          if (Math.abs(Math.sin((dy * 0.9 + dx * 0.25) * 9)) < 0.12) b *= 0.45;
        } else {
          var d = Math.sqrt(d2);
          b = d < 1.12 ? 0.22 * (1.12 - d) / 0.12 : 0; // a thin glow just outside the rim
        }
        if (b > t) ctx.fillRect(i * c, j * c, px, px);
      }
    }
    // scattered single pixels around it
    var rand = rng(w * 7 + h * 13 + 1);
    for (var s = 0; s < L.stars; s++) {
      var sx = Math.floor(rand() * cols), sy = Math.floor(rand() * rows);
      var ddx = (sx * c - L.x) / L.r, ddy = (sy * c - L.y) / L.r;
      if (ddx * ddx + ddy * ddy > 1.4) ctx.fillRect(sx * c, sy * c, px, px);
    }
    return true;
  }

  function paint(scope) {
    var list = (scope || document).querySelectorAll('canvas[data-pixel]');
    for (var k = 0; k < list.length; k++) { try { drawPlanet(list[k]); } catch (e) { /* decorative */ } }
  }

  // ---- settling headlines ------------------------------------------------------------
  var observer = null;
  function settle(el) {
    if (!el || el.getAttribute('data-settled') || reduced()) return;
    el.setAttribute('data-settled', '1');
    var plain = el.textContent.replace(/\s+/g, ' ').trim();
    var rand = rng(plain.length * 31 + 7);

    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var word = document.createElement('span');
        word.className = 'w';
        Array.from(part).forEach(function (ch) {
          var s = document.createElement('span');
          s.className = 'ch' + (rand() < 0.3 ? ' b' : '');
          s.textContent = ch;
          s.style.setProperty('--dy', ((rand() - 0.5) * 0.5).toFixed(2) + 'em');
          s.style.transitionDelay = Math.round(rand() * 520) + 'ms';
          word.appendChild(s);
        });
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });

    var visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    while (el.firstChild) visual.appendChild(el.firstChild);
    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = plain;
    el.appendChild(sr);
    el.appendChild(visual);
    el.classList.add('settle');

    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); }
        });
      }, { threshold: 0.3 });
    }
    // two frames so the starting positions are painted before they settle
    requestAnimationFrame(function () { requestAnimationFrame(function () { observer.observe(el); }); });
  }

  function settleAll(scope) {
    var list = (scope || document).querySelectorAll('[data-settle]');
    for (var k = 0; k < list.length; k++) settle(list[k]);
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { paint(document); }, 150);
  });

  root.SLPixel = { paint: paint, settle: settle, settleAll: settleAll };
})(typeof self !== 'undefined' ? self : this);
