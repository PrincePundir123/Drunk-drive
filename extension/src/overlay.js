/* SecondLook extension — the "second look" prompt, rendered in a CLOSED shadow root so
 * the host page's CSS and scripts can't restyle or read it. */
(function (root) {
  'use strict';

  // Night Mode values from css/tokens.css, inlined: a closed shadow root on someone
  // else's site can't load our stylesheet. Keep these in sync with the tokens.
  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box}',
    '.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;font:20px/1.45 "Atkinson Hyperlegible","Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;color:#FFFDF9;z-index:2147483647}',
    '.card{width:100%;max-width:520px;max-height:calc(100vh - 24px);overflow:auto;background:#1C1917;border-radius:24px 24px 0 0;border-top:3px solid #FFA58E;padding:12px 24px 24px;box-shadow:0 -12px 40px rgba(0,0,0,.45);text-align:left;animation:up .42s cubic-bezier(.2,.8,.2,1)}',
    '@media (min-width:600px){.card{margin-bottom:24px;border-radius:24px}}',
    '.grip{width:44px;height:5px;border-radius:999px;background:#4A433E;margin:0 auto 16px}',
    '.brand{display:flex;align-items:center;gap:8px;font-size:16px;color:#D6D0CB;margin-bottom:8px}',
    '.eye{width:72px;height:46px;margin:4px 0 12px}',
    '.eye .eye-shape{fill:#292524}.eye .eye-outline{fill:none;stroke:#FFFDF9;stroke-width:3}.eye .eye-track{fill:none;stroke:#4A433E;stroke-width:5}',
    '.eye .eye-iris{fill:none;stroke:#FFB4A2;stroke-width:5;stroke-linecap:round}.eye .eye-pupil{fill:#FFB4A2}.eye .eye-bar{fill:#292524}',
    '.brand .eye{width:28px;height:18px;margin:0}',
    'h2{font-size:32px;line-height:1.1;letter-spacing:-.03em;margin:0 0 8px;color:#FFFDF9;font-weight:700}',
    'p{margin:0 0 16px;color:#D6D0CB}',
    'p b{color:#FFFDF9}',
    '.plan{background:rgba(255,165,142,.14);border:2px solid #FFB4A2;border-radius:14px;padding:12px 16px;margin:0 0 16px;color:#FFFDF9;font-weight:700}',
    '.plan q{display:block;font-weight:400;margin-top:6px;quotes:"\\201C" "\\201D"}',
    '.stack{display:grid;gap:12px;margin-top:8px}',
    'button,a.btn{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:56px;padding:8px 24px;border-radius:14px;font-weight:700;font-size:20px;cursor:pointer;text-align:center;border:2px solid #4A433E;background:#292524;color:#FFFDF9}',
    'button.primary{background:#FFA58E;color:#1C1917;border-color:#FFA58E;min-height:64px;font-size:24px}',
    'button.quiet{background:transparent;border-color:transparent;color:#FFB4A2;text-decoration:underline;text-underline-offset:4px}',
    'button:focus-visible,a.btn:focus-visible{outline:3px solid #FFB4A2;outline-offset:3px}',
    '.rides{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}',
    '.rides a.btn{min-height:48px;padding:8px 16px;font-size:18px}',
    '.count p{margin:0 0 8px}',
    '.count b{color:#FFFDF9}',
    '.bar{height:8px;background:#3A3431;border-radius:999px;overflow:hidden;margin-bottom:16px}',
    '.bar span{display:block;height:100%;background:#FFB4A2;width:100%;border-radius:inherit;transition:width .25s linear}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1C1917;color:#FFFDF9;border:1px solid #4A433E;font:700 16px/1.4 "Atkinson Hyperlegible",system-ui,sans-serif;padding:12px 20px;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:2147483647;max-width:calc(100vw - 32px)}',
    '@keyframes up{from{transform:translateY(100%)}to{transform:none}}',
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
    var eye = function (level) { return root.SLIcons ? root.SLIcons.eye({ level: level }) : ''; };
    m.shadow.innerHTML = '<style>' + CSS + '</style>' +
      '<div class="backdrop"><div class="card" role="dialog" aria-modal="true" aria-labelledby="t" aria-describedby="d">' +
        '<div class="grip" aria-hidden="true"></div>' +
        '<div class="brand">' + eye('ok') + 'SecondLook</div>' +
        eye('count') +
        '<h2 id="t">Want a second look?</h2>' +
        '<p id="d">This doesn’t look like how you usually text' + (opts.reasons && opts.reasons.length ? ': <b>' + esc(opts.reasons[0].charAt(0).toLowerCase() + opts.reasons[0].slice(1)) + '</b>.' : '.') + '</p>' +
        (opts.plan ? '<div class="plan">' + esc(opts.plan.text) + (opts.plan.note ? '<q>' + esc(opts.plan.note) + '</q>' : '') + '</div>' : '') +
        (rides && !opts.plan ? '<p>Book a ride home:</p><div class="rides">' + rides + '</div>' : '') +
        '<div class="count"><p>Checking in with you in <b data-secs>' + secs + '</b>s</p><div class="bar" aria-hidden="true"><span></span></div></div>' +
        '<div class="stack">' +
          '<button type="button" class="primary" data-a="edit">Edit my message</button>' +
          '<button type="button" data-a="send">Send it anyway</button>' +
          '<button type="button" class="quiet" data-a="check">Check how I’m doing</button>' +
        '</div>' +
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
