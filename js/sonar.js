/* SecondLook — sonar grid background.
 * A vanilla-JS port of the SonarGrid component: a decorative field of square pixels that answers taps
 * with expanding rings. It fills the viewport behind all content (fixed, so the grid never
 * shifts while you scroll), reads its colour from the theme (the accent of the current
 * Sober/Night mode), idles when no ring is alive, pauses in hidden tabs, and draws a still
 * grid under prefers-reduced-motion. Purely decorative: aria-hidden, no pointer events. */
(function (root) {
  'use strict';

  var MAX_DPR = 2;

  var DEFAULTS = {
    spacing: 26,          // distance between dots, CSS px
    dotRadius: 1.4,       // dot radius at rest
    baseOpacity: 0.28,    // resting dot opacity
    maxOpacity: 1,        // opacity of a dot at the wave peak
    pingEvery: 2.4,       // seconds between ambient pings (0 = off)
    speed: 260,           // wavefront speed, px per second
    ringWidth: 90,        // thickness of the wavefront
    amplitude: 2.2,       // how much a dot grows at the wave peak
    interactive: true,    // ping where the user taps or clicks
    maxRings: 6,          // oldest rings are dropped first
    seedPing: true,       // start with one ring mid-expansion so the first frame shows the idea
    pingArea: [0.15, 0.2, 0.85, 0.8], // where ambient pings may spawn [x0, y0, x1, y1]
    pauseWhen: null,      // optional () => boolean: skip ambient pings while it returns true
    startDelay: 0         // ms before the first ping, so the page can finish loading first
  };

  function create(opts) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = opts && opts[k] !== undefined ? opts[k] : DEFAULTS[k]; });

    var canvas = document.createElement('canvas');
    canvas.className = 'sonar';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener: function () {} };
    var width = 0, height = 0, raf = 0, timer = 0, seeded = false, stroke = '';
    var rings = [];
    var nextPing = performance.now() + o.startDelay + o.pingEvery * 1000;
    var startAt = performance.now() + o.startDelay;

    function readColor() { stroke = getComputedStyle(canvas).color; }

    function addRing(x, y, born) {
      readColor();
      rings.push({ x: x, y: y, born: born });
      while (rings.length > o.maxRings) rings.shift();
    }

    // The resting grid is drawn once into an off-screen canvas (on resize or colour change).
    // Each frame then copies it and redraws only the dots on a moving wavefront, so a frame
    // costs a few hundred dots at most instead of the whole field.
    var still = document.createElement('canvas'), stillCtx = still.getContext('2d');
    var grid = { cols: 0, rows: 0, offsetX: 0, offsetY: 0 };

    function buildStill(dpr) {
      grid.cols = Math.ceil(width / o.spacing) + 1;
      grid.rows = Math.ceil(height / o.spacing) + 1;
      // centre the grid so the margins are equal on every side
      grid.offsetX = (width - (grid.cols - 1) * o.spacing) / 2;
      grid.offsetY = (height - (grid.rows - 1) * o.spacing) / 2;
      still.width = canvas.width; still.height = canvas.height;
      stillCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stillCtx.clearRect(0, 0, width, height);
      stillCtx.fillStyle = stroke;
      stillCtx.globalAlpha = o.baseOpacity;
      stillCtx.beginPath();
      for (var i = 0; i < grid.cols; i++) {
        var cx = grid.offsetX + i * o.spacing;
        for (var j = 0; j < grid.rows; j++) {
          var cy = grid.offsetY + j * o.spacing;
          stillCtx.rect(cx - o.dotRadius, cy - o.dotRadius, o.dotRadius * 2, o.dotRadius * 2);
        }
      }
      stillCtx.fill();
      stillCtx.globalAlpha = 1;
    }

    function draw(now) {
      var lifetime = (Math.hypot(width, height) + o.ringWidth) / o.speed; // seconds until a ring leaves the screen
      rings = rings.filter(function (r) { return (now - r.born) / 1000 < lifetime; });
      var active = rings.filter(function (r) { return r.born <= now; });

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(still, 0, 0);
      var dpr = canvas.width / width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!active.length) return;

      ctx.fillStyle = stroke;
      var sp = o.spacing, rw = o.ringWidth;
      for (var n = 0; n < active.length; n++) {
        var r = active[n];
        var age = (now - r.born) / 1000, radius = age * o.speed, fade = 1 - age / lifetime;
        var inner = Math.max(0, radius - rw), outer = radius + rw;
        // only the grid cells inside this ring's bounding box
        var i0 = Math.max(0, Math.floor((r.x - outer - grid.offsetX) / sp)), i1 = Math.min(grid.cols - 1, Math.ceil((r.x + outer - grid.offsetX) / sp));
        var j0 = Math.max(0, Math.floor((r.y - outer - grid.offsetY) / sp)), j1 = Math.min(grid.rows - 1, Math.ceil((r.y + outer - grid.offsetY) / sp));
        for (var i = i0; i <= i1; i++) {
          var cx = grid.offsetX + i * sp, dx = cx - r.x;
          for (var j = j0; j <= j1; j++) {
            var cy = grid.offsetY + j * sp, dy = cy - r.y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < inner || d > outer) continue;
            var t = 1 - Math.abs(d - radius) / rw;
            var e = t * t * (3 - 2 * t) * fade; // smoothstep, fading with age
            if (e < 0.01) continue;
            ctx.globalAlpha = (o.maxOpacity - o.baseOpacity) * e;
            var rr = o.dotRadius * (1 + o.amplitude * e);
            ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function resize() {
      width = Math.max(1, Math.round(window.innerWidth));
      height = Math.max(1, Math.round(window.innerHeight));
      var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColor();
      buildStill(dpr);
      if (!seeded) {
        seeded = true;
        var a = o.pingArea;
        if (o.seedPing && !reduceMotion.matches) addRing(width * (a[0] + (a[2] - a[0]) * 0.68), height * (a[1] + (a[3] - a[1]) * 0.34), Math.max(performance.now(), startAt) - 500);
      }
      readColor();
      draw(performance.now());
    }

    function scheduleIdle(delay) {
      clearTimeout(timer);
      timer = setTimeout(function () { tick(performance.now()); }, Math.max(16, delay));
    }

    function tick(now) {
      raf = 0;
      if (document.hidden) return;
      if (reduceMotion.matches) { rings = []; draw(now); return; }
      if (o.pingEvery > 0 && now >= nextPing) {
        if (!(o.pauseWhen && o.pauseWhen())) {
          var a = o.pingArea;
          addRing(width * (a[0] + Math.random() * (a[2] - a[0])), height * (a[1] + Math.random() * (a[3] - a[1])), now);
        }
        nextPing = now + o.pingEvery * 1000;
      }
      draw(now);
      var waiting = rings.filter(function (r) { return r.born > now; });
      if (rings.length > waiting.length) raf = requestAnimationFrame(tick);
      else if (waiting.length) scheduleIdle(waiting[0].born - now);
      else if (o.pingEvery > 0) scheduleIdle(nextPing - now);
    }

    function wake() {
      if (!raf) { clearTimeout(timer); raf = requestAnimationFrame(tick); }
    }

    function refresh() {
      var before = stroke;
      readColor();
      if (stroke !== before) buildStill(Math.min(window.devicePixelRatio || 1, MAX_DPR));
      nextPing = Math.min(nextPing, performance.now() + o.pingEvery * 1000);
      if (reduceMotion.matches || !raf) draw(performance.now());
      wake();
    }

    function onDown(e) {
      if (!o.interactive || reduceMotion.matches) return;
      addRing(e.clientX, e.clientY, performance.now());
      wake();
    }
    function onVisibility() { if (!document.hidden) wake(); }

    readColor();
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', wake);
    // The theme colour changes when the app switches between Sober Mode and Night Mode.
    var mo = new MutationObserver(refresh);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode'] });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-mode'] });
    wake();

    return {
      refresh: refresh,
      destroy: function () {
        mo.disconnect();
        window.removeEventListener('resize', resize);
        document.removeEventListener('pointerdown', onDown);
        document.removeEventListener('visibilitychange', onVisibility);
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        canvas.remove();
      }
    };
  }

  root.SLSonar = { create: create, DEFAULTS: DEFAULTS };
})(typeof self !== 'undefined' ? self : this);
