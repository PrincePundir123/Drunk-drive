/* SecondLook — the three short tasks used for the baseline and quick checks,
 * plus the keystroke recorder used by the message composer.
 * Every widget returns { destroy() } so views can clean up timers and listeners. */
(function (root) {
  'use strict';

  var M = root.SLMetrics;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------------------------------------------------------------------------
  // Keystroke recorder: timing only. We never store what you type here.
  // Uses `input` events (not keydown) so it also works with mobile keyboards.
  // ---------------------------------------------------------------------------
  function KeystrokeRecorder(el) {
    this.el = el;
    this.events = [];
    this.prevLen = el.value.length;
    this._onInput = this.onInput.bind(this);
    el.addEventListener('input', this._onInput);
  }
  KeystrokeRecorder.prototype.onInput = function (e) {
    var t = performance.now();
    var len = this.el.value.length;
    var diff = len - this.prevLen;
    this.prevLen = len;
    var it = (e && e.inputType) || '';
    var kind;
    if (it.indexOf('delete') === 0) kind = 'delete';
    else if (it.indexOf('insert') === 0) kind = 'insert';
    else kind = diff < 0 ? 'delete' : 'insert';
    this.events.push({ t: t, kind: kind, n: Math.max(1, Math.abs(diff)) });
  };
  KeystrokeRecorder.prototype.reset = function () {
    this.events = [];
    this.prevLen = this.el.value.length;
  };
  KeystrokeRecorder.prototype.destroy = function () {
    this.el.removeEventListener('input', this._onInput);
  };

  // ---------------------------------------------------------------------------
  // 1) Reaction time: tap the moment the pad turns green.
  // ---------------------------------------------------------------------------
  function reactionTest(container, opts) {
    opts = opts || {};
    var trials = opts.trials || 5;
    container.innerHTML =
      '<div class="rt">' +
        '<button type="button" class="rt-pad" data-state="idle" aria-live="polite">' +
          '<span class="rt-msg">Tap here to start</span>' +
          '<span class="rt-sub">' + trials + ' rounds · tap the moment it turns green</span>' +
        '</button>' +
        '<div class="rt-dots" aria-hidden="true">' + new Array(trials + 1).join('<i></i>') + '</div>' +
      '</div>';

    var pad = container.querySelector('.rt-pad');
    var msgEl = container.querySelector('.rt-msg');
    var subEl = container.querySelector('.rt-sub');
    var dots = container.querySelectorAll('.rt-dots i');
    var phase = 'idle', timer = null, goAt = 0, times = [], falseStarts = 0, dead = false;

    function show(state, msg, sub) {
      pad.setAttribute('data-state', state);
      msgEl.textContent = msg;
      subEl.textContent = sub || '';
    }
    function arm() {
      if (dead) return;
      phase = 'wait';
      show('wait', 'Wait for green…', 'Don’t tap yet');
      timer = setTimeout(function () {
        phase = 'go';
        show('go', 'TAP!', '');
        goAt = performance.now();
      }, 1000 + Math.random() * 2500);
    }
    function early(msg) {
      clearTimeout(timer);
      falseStarts++;
      phase = 'pause';
      show('early', msg, 'Restarting this round…');
      timer = setTimeout(arm, 1300);
    }
    function hit() {
      if (dead) return;
      if (phase === 'idle') { arm(); return; }
      if (phase === 'wait') { early('Too soon!'); return; }
      if (phase !== 'go') return; // ignore taps while showing a result
      var rt = performance.now() - goAt;
      if (rt < 100) { early('Too fast to be real'); return; }
      times.push(rt);
      if (dots[times.length - 1]) dots[times.length - 1].className = 'on';
      if (times.length >= trials) {
        phase = 'done';
        show('done', Math.round(rt) + ' ms', 'All rounds done');
        timer = setTimeout(function () {
          if (dead) return;
          if (opts.onDone) opts.onDone({ reactionMs: M.median(times), trials: times.slice(), falseStarts: falseStarts });
        }, 700);
      } else {
        phase = 'pause';
        show('result', Math.round(rt) + ' ms', 'Round ' + times.length + ' of ' + trials);
        timer = setTimeout(arm, 1000);
      }
    }
    function onPointer(e) { if (e.button > 0) return; e.preventDefault(); hit(); }
    function onKey(e) {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); hit(); }
    }
    pad.addEventListener('pointerdown', onPointer);
    pad.addEventListener('keydown', onKey);

    return {
      destroy: function () {
        dead = true;
        clearTimeout(timer);
        pad.removeEventListener('pointerdown', onPointer);
        pad.removeEventListener('keydown', onKey);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 2) Steady hand: follow a slowly moving dot with your finger or cursor.
  // Error is measured as % of the play area so it works on any screen size.
  // ---------------------------------------------------------------------------
  function trackingTest(container, opts) {
    opts = opts || {};
    var duration = opts.duration || 12000;
    container.innerHTML =
      '<div class="trk">' +
        '<canvas class="trk-canvas" role="img" aria-label="Moving dot. Press on it and follow it."></canvas>' +
        '<div class="trk-hint">Press on the glowing dot, then follow it for ' + Math.round(duration / 1000) + ' seconds</div>' +
        '<div class="trk-timer"><span></span></div>' +
      '</div>' +
      '<div class="trk-foot"><button type="button" class="linkish trk-skip">Can’t use a pointer? Skip this task</button></div>';

    var canvas = container.querySelector('canvas');
    var hint = container.querySelector('.trk-hint');
    var bar = container.querySelector('.trk-timer span');
    var skipBtn = container.querySelector('.trk-skip');
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, raf = 0, running = false, done = false, startAt = 0, pointer = null, errors = [], path = null;

    function target(t) {
      var ax = Math.max(20, W / 2 - 30), ay = Math.max(20, H / 2 - 30);
      return { x: W / 2 + ax * Math.sin(0.85 * t), y: H / 2 + ay * Math.sin(1.3 * t + 0.6) };
    }
    function size() {
      var r = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      path = null;
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      if (!path && typeof Path2D !== 'undefined') {
        path = new Path2D();
        for (var s = 0; s <= duration / 1000; s += 0.04) {
          var q = target(s);
          if (s === 0) path.moveTo(q.x, q.y); else path.lineTo(q.x, q.y);
        }
      }
      if (path) {
        ctx.strokeStyle = 'rgba(245,245,247,0.14)';
        ctx.lineWidth = 2;
        ctx.stroke(path);
      }
      var p = target(t);
      var g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 30);
      g.addColorStop(0, 'rgba(123,123,255,0.55)');
      g.addColorStop(1, 'rgba(123,123,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7B7BFF';
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill();
      if (pointer && running) {
        ctx.strokeStyle = '#F5F5F7';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 7, 0, Math.PI * 2); ctx.stroke();
      }
    }
    function local(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onDown(e) {
      if (done) return;
      var pt = local(e);
      if (!running) {
        var p = target(0);
        if (Math.hypot(pt.x - p.x, pt.y - p.y) > 48) { hint.textContent = 'Start on the glowing dot'; return; }
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
        pointer = pt;
        running = true;
        startAt = performance.now();
        hint.classList.add('hide');
        raf = requestAnimationFrame(loop);
      } else {
        pointer = pt;
      }
    }
    function onMove(e) { if (running) pointer = local(e); }
    function loop(now) {
      if (!running) return;
      var el = now - startAt;
      var t = el / 1000;
      draw(t);
      var p = target(t);
      if (el > 700 && pointer) errors.push(Math.hypot(pointer.x - p.x, pointer.y - p.y) / Math.min(W, H) * 100);
      bar.style.width = Math.min(100, el / duration * 100) + '%';
      if (el >= duration) { finish(false); return; }
      raf = requestAnimationFrame(loop);
    }
    function finish(skipped) {
      if (done) return;
      running = false; done = true;
      cancelAnimationFrame(raf);
      hint.textContent = skipped ? 'Skipped' : 'Done';
      hint.classList.remove('hide');
      skipBtn.disabled = true;
      var err = !skipped && errors.length ? M.mean(errors) : null;
      if (opts.onDone) opts.onDone({ trackingErr: err, skipped: !!skipped, frames: errors.length });
    }
    function onResize() { if (!running && !done) { size(); draw(0); } }
    function onSkip() { finish(true); }

    size(); draw(0);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('resize', onResize);
    skipBtn.addEventListener('click', onSkip);

    return {
      destroy: function () {
        running = false; done = true;
        cancelAnimationFrame(raf);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        window.removeEventListener('resize', onResize);
        skipBtn.removeEventListener('click', onSkip);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 3) Typing rhythm: type short sentences the way you normally would.
  // ---------------------------------------------------------------------------
  var SENTENCES = [
    'Please call me when you get home safe, I will leave the porch light on.',
    'We should meet at the station around nine and grab some food after.',
    'My sister is bringing the blue umbrella because it might rain tonight.',
    'The quick brown fox jumps over the lazy dog near the river bank.',
    'I left my keys on the kitchen table next to the charger and my wallet.',
    'Text me the address and I will find a ride there after work tomorrow.'
  ];

  function typingTest(container, opts) {
    opts = opts || {};
    var sentences = opts.sentences && opts.sentences.length ? opts.sentences : SENTENCES.slice(0, 2);
    var idx = 0, samples = [], rec = null, input = null, btn = null, hint = null, finished = false, focusTimer = null;

    function ready() {
      return M.normText(input.value).length >= Math.floor(M.normText(sentences[idx]).length * 0.9);
    }
    function render() {
      container.innerHTML =
        '<div class="tt">' +
          '<p class="tt-step">Sentence ' + (idx + 1) + ' of ' + sentences.length + '</p>' +
          '<p class="tt-target">' + esc(sentences[idx]) + '</p>' +
          '<label class="sr-only" for="tt-input">Type the sentence shown above</label>' +
          '<textarea id="tt-input" class="tt-input" rows="3" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Start typing…"></textarea>' +
          '<div class="tt-row"><span class="tt-hint" aria-live="polite"></span>' +
          '<button type="button" class="btn primary tt-next" disabled>' + (idx + 1 < sentences.length ? 'Next' : 'Finish') + '</button></div>' +
        '</div>';
      input = container.querySelector('.tt-input');
      btn = container.querySelector('.tt-next');
      hint = container.querySelector('.tt-hint');
      if (rec) rec.destroy();
      rec = new KeystrokeRecorder(input);
      input.addEventListener('paste', function (e) { e.preventDefault(); hint.textContent = 'Please type it — pasting skips the test.'; });
      input.addEventListener('drop', function (e) { e.preventDefault(); });
      input.addEventListener('input', function () { btn.disabled = !ready(); if (ready()) hint.textContent = 'Press Enter or tap ' + btn.textContent; });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (ready()) next(); else hint.textContent = 'Keep going — finish the sentence first.';
        }
      });
      btn.addEventListener('click', next);
      clearTimeout(focusTimer);
      focusTimer = setTimeout(function () { if (!finished && document.contains(input)) input.focus(); }, 60);
    }
    function next() {
      if (finished || !ready()) return;
      var ks = M.analyzeKeystrokes(rec.events);
      samples.push(Object.assign({}, ks, { typoRate: M.typoRate(input.value, sentences[idx]) }));
      idx++;
      if (idx < sentences.length) { render(); return; }
      finished = true;
      rec.destroy(); rec = null;
      if (opts.onDone) opts.onDone(samples);
    }

    render();
    return {
      destroy: function () {
        finished = true;
        clearTimeout(focusTimer);
        if (rec) { rec.destroy(); rec = null; }
      }
    };
  }

  function pickSentences(n) {
    var pool = SENTENCES.slice();
    var out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }

  root.SLTests = {
    KeystrokeRecorder: KeystrokeRecorder,
    reactionTest: reactionTest,
    trackingTest: trackingTest,
    typingTest: typingTest,
    pickSentences: pickSentences,
    SENTENCES: SENTENCES
  };
})(typeof self !== 'undefined' ? self : this);
