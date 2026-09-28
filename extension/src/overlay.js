/* SecondLook extension — the "second look" prompt, rendered in a CLOSED shadow root so
 * the host page's CSS and scripts can't restyle or read it. */
(function (root) {
  'use strict';

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.backdrop{position:fixed;inset:0;background:rgba(3,6,15,.72);display:flex;align-items:center;justify-content:center;padding:16px;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#e8edf8;z-index:2147483647}',
    '.card{width:100%;max-width:420px;max-height:calc(100vh - 32px);overflow:auto;background:#131b31;border:1px solid #26314f;border-radius:20px;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.5);text-align:center;animation:rise .18s ease}',
    '.icon{font-size:36px;line-height:1}',
    'h2{font-size:20px;margin:10px 0 6px;color:#e8edf8}',
    'p{margin:0 0 12px;color:#9ca8c6}',
    '.brand{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6ee7c8;font-weight:700}',
    'ul{list-style:none;margin:0 0 12px;padding:10px 14px;background:#0e1528;border-radius:12px;text-align:left;color:#c9d2e8}',
    'li{padding:2px 0}',
    '.plan{text-align:left;background:#0e1528;border:1px solid #3a4870;border-radius:12px;padding:10px 14px;margin:0 0 12px;color:#e8edf8}',
    '.plan q{display:block;color:#fbbf24;margin-top:4px}',
    '.stack{display:grid;gap:10px;margin-top:6px}',
    'button,a.btn{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:46px;padding:10px 16px;border-radius:12px;font-weight:600;cursor:pointer;text-align:center;border:1px solid #26314f;background:#19233f;color:#e8edf8}',
    'button.primary{background:#6ee7c8;color:#03261e;border-color:#6ee7c8}',
    'button.ghost{background:transparent;color:#c9d2e8}',
    'button:focus-visible,a.btn:focus-visible{outline:3px solid #a5b4fc;outline-offset:2px}',
    '.rides{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:0 0 10px}',
    '.rides a.btn{min-height:40px;padding:8px 12px;font-size:14px}',
    '.bar{height:4px;background:#26314f;border-radius:4px;overflow:hidden;margin-top:14px}',
    '.bar span{display:block;height:100%;background:#fbbf24;width:100%}',
    '.foot{font-size:12px;color:#9ca8c6;margin:8px 0 0}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#e8edf8;color:#0a0f1f;font:600 14px/1.4 system-ui,sans-serif;padding:10px 16px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:2147483647;max-width:calc(100vw - 32px)}',
    '@keyframes rise{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.card{animation:none}.bar span{transition:none}}'
  ].join('\n');

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mount() {
    var host = document.createElement('secondlook-overlay');
    host.setAttribute('style', 'all:initial;position:fixed;inset:0;z-index:2147483647;');
    var shadow = host.attachShadow({ mode: 'closed' });
    // Keep keystrokes inside the prompt from reaching the page's own shortcuts.
    ['keydown', 'keyup', 'keypress', 'input'].forEach(function (t) {
      host.addEventListener(t, function (e) { e.stopPropagation(); });
    });
    (document.body || document.documentElement).appendChild(host);
    return { host: host, shadow: shadow };
  }

  /**
   * opts: { reasons[], seconds, siteLabel, plan: {text, note}, rides: [{name,url,id}],
   *         onEdit, onSend, onCheck, onTimeout, onRide(ride) }
   */
  function show(opts) {
    var m = mount();
    var secs = Math.max(5, opts.seconds || 45);
    var prevFocus = document.activeElement;
    var done = false, timer = null, t0 = Date.now(), lastSpoken = null;
    var rides = (opts.rides || []).map(function (r, i) {
      return '<a class="btn" href="' + esc(r.url) + '" target="_blank" rel="noopener" data-ride="' + i + '">' + esc(r.name) + '</a>';
    }).join('');
    m.shadow.innerHTML = '<style>' + CSS + '</style>' +
      '<div class="backdrop"><div class="card" role="dialog" aria-modal="true" aria-labelledby="t" aria-describedby="d">' +
        '<div class="brand">SecondLook</div>' +
        '<div class="icon" aria-hidden="true">👀</div>' +
        '<h2 id="t">Want a second look?</h2>' +
        '<p id="d">This looks a little different from how you usually text.</p>' +
        (opts.reasons && opts.reasons.length ? '<ul aria-label="What’s different">' + opts.reasons.map(function (r) { return '<li>• ' + esc(r) + '</li>'; }).join('') + '</ul>' : '') +
        (opts.plan ? '<div class="plan">' + esc(opts.plan.text) + (opts.plan.note ? '<q>' + esc(opts.plan.note) + '</q>' : '') + '</div>' : '') +
        (rides ? '<p>Get a ride home:</p><div class="rides">' + rides + '</div>' : '') +
        '<div class="stack">' +
          '<button type="button" class="primary" data-a="edit">Edit message</button>' +
          '<button type="button" data-a="send">Send anyway</button>' +
          '<button type="button" class="ghost" data-a="check">Check how I’m doing (1 min)</button>' +
        '</div>' +
        '<div class="bar" aria-hidden="true"><span></span></div>' +
        '<p class="foot">If there’s no answer in <b data-secs>' + secs + '</b>s, SecondLook will check in with you.</p>' +
        '<div class="sr" aria-live="polite" data-live></div>' +
      '</div></div>';

    var card = m.shadow.querySelector('.card');
    var bar = m.shadow.querySelector('.bar span');
    var secsEl = m.shadow.querySelector('[data-secs]');
    var live = m.shadow.querySelector('[data-live]');
    var buttons = function () { return Array.prototype.slice.call(card.querySelectorAll('button, a.btn')); };

    function close(restoreFocus) {
      if (done) return;
      done = true;
      clearInterval(timer);
      m.host.remove();
      if (restoreFocus && prevFocus && prevFocus.focus && document.contains(prevFocus)) {
        try { prevFocus.focus(); } catch (e) { /* ignore */ }
      }
    }
    function act(a) {
      if (done) return;
      close(a === 'edit');
      try {
        if (a === 'edit' && opts.onEdit) opts.onEdit();
        else if (a === 'send' && opts.onSend) opts.onSend();
        else if (a === 'check' && opts.onCheck) opts.onCheck();
      } catch (e) { /* fail open */ }
    }

    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]');
      if (b) { act(b.getAttribute('data-a')); return; }
      var r = e.target.closest('[data-ride]');
      if (r && opts.onRide) { try { opts.onRide(opts.rides[Number(r.getAttribute('data-ride'))]); } catch (err) { /* ignore */ } }
    });
    m.shadow.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); act('edit'); return; }
      if (e.key === 'Tab') { // keep focus inside the prompt
        var list = buttons();
        var i = list.indexOf(m.shadow.activeElement);
        e.preventDefault();
        var next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i + 1) % list.length;
        list[next].focus();
      }
    });

    timer = setInterval(function () {
      var left = secs * 1000 - (Date.now() - t0);
      var s = Math.max(0, Math.ceil(left / 1000));
      bar.style.width = Math.max(0, left / (secs * 10)) + '%';
      secsEl.textContent = s;
      if ((s === 30 || s === 10 || s === 5) && lastSpoken !== s) { lastSpoken = s; live.textContent = s + ' seconds left to answer.'; }
      if (left <= 0) {
        close(false);
        try { if (opts.onTimeout) opts.onTimeout(); } catch (e) { /* fail open */ }
      }
    }, 250);

    setTimeout(function () { var b = card.querySelector('button.primary'); if (b && !done) b.focus(); }, 30);
    return { close: function () { close(false); } };
  }

  function toast(msg, ms) {
    try {
      var m = mount();
      m.host.setAttribute('style', 'all:initial;position:fixed;left:0;right:0;bottom:0;z-index:2147483647;');
      m.shadow.innerHTML = '<style>' + CSS + '</style><div class="toast" role="status">' + esc(msg) + '</div>';
      setTimeout(function () { m.host.remove(); }, ms || 3500);
    } catch (e) { /* ignore */ }
  }

  root.SLOverlay = { show: show, toast: toast };
})(typeof self !== 'undefined' ? self : this);
